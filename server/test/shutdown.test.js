import test from "node:test";
import assert from "node:assert/strict";
import { gracefulShutdown } from "../src/index.js";

// ─── Helpers: mock objects that track calls ──────────────────────────

function mockIo(tracker) {
  return {
    close(cb) {
      tracker.push("io.close");
      if (cb) cb();
    },
  };
}

function mockServer(tracker) {
  return {
    close(cb) {
      tracker.push("server.close");
      if (cb) cb();
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

test("gracefulShutdown closes io then server then exits 0", () => {
  const tracker = [];
  const originalExit = process.exit;
  const exitCodes = [];

  process.exit = (code) => exitCodes.push(code);

  try {
    gracefulShutdown(mockServer(tracker), mockIo(tracker), "SIGTERM");

    // io.close fires synchronously (mock), then server.close, then exit(0)
    assert.deepEqual(tracker, ["io.close", "server.close"]);
    assert.deepEqual(exitCodes, [0]);
  } finally {
    process.exit = originalExit;
  }
});

test("gracefulShutdown logs the signal name and shutdown message", () => {
  const tracker = [];
  const originalExit = process.exit;
  const originalLog = console.log;
  const logs = [];

  console.log = (...args) => logs.push(args.join(" "));
  process.exit = () => {};

  try {
    gracefulShutdown(mockServer(tracker), mockIo(tracker), "SIGINT");

    assert.ok(
      logs.some((m) => m.includes("SIGINT")),
      "should log signal name",
    );
    assert.ok(
      logs.some((m) => m.toLowerCase().includes("shutting down")),
      "should log shutdown message",
    );
  } finally {
    process.exit = originalExit;
    console.log = originalLog;
  }
});

test("gracefulShutdown fires io.close before server.close", () => {
  const callOrder = [];
  const originalExit = process.exit;
  process.exit = () => {};

  const srv = {
    close(cb) {
      callOrder.push("server");
      if (cb) cb();
    },
  };
  const io = {
    close(cb) {
      callOrder.push("io");
      if (cb) cb();
    },
  };

  try {
    gracefulShutdown(srv, io, "SIGTERM");
    assert.deepEqual(callOrder, ["io", "server"]);
  } finally {
    process.exit = originalExit;
  }
});

test("gracefulShutdown schedules a force-exit timer (10 s)", () => {
  const originalExit = process.exit;
  process.exit = () => {};

  const timers = [];
  const origSetTimeout = global.setTimeout;
  global.setTimeout = (fn, _ms) => {
    timers.push(_ms);
    // Return a dummy timer id; never fire the callback so no side effects
    return origSetTimeout(() => {}, 0);
  };

  try {
    gracefulShutdown(
      {
        close(cb) {
          cb();
        },
      },
      {
        close(cb) {
          cb();
        },
      },
      "SIGTERM",
    );
    assert.ok(timers.length > 0, "should schedule a force-exit timer");
    assert.equal(timers[0], 10_000, "force-exit timeout should be exactly 10 000 ms");
  } finally {
    process.exit = originalExit;
    global.setTimeout = origSetTimeout;
  }
});

test("gracefulShutdown force-exits with code 1 on timeout", (t, done) => {
  const originalExit = process.exit;
  const exitCodes = [];

  process.exit = (code) => exitCodes.push(code);

  // io closes, but server never calls its callback (stuck)
  const stuckServer = {
    close(_cb) {
      /* never calls cb */
    },
  };

  // Reduce the 10 s timeout to 200 ms for the test
  const origSetTimeout = global.setTimeout;
  global.setTimeout = (fn, _ms) => origSetTimeout(fn, 200);

  // NOTE: Do NOT restore globals in finally — the force-exit timer fires
  // asynchronously and needs the mocks still in place.  We restore them
  // in the done callback instead.
  gracefulShutdown(stuckServer, mockIo([]), "SIGTERM");

  // Wait for the force-exit timer to fire
  origSetTimeout(() => {
    try {
      assert.ok(exitCodes.includes(1), "should force-exit with code 1 on timeout");
      done();
    } catch (err) {
      done(err);
    } finally {
      process.exit = originalExit;
      global.setTimeout = origSetTimeout;
    }
  }, 500);
});
