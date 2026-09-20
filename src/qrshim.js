'use strict';

/**
 * BotForge QR capture shim.
 *
 * Loaded into child bot processes via NODE_OPTIONS="--require <this file>".
 * It wraps the `qrcode-terminal` module so that every QR the bot prints is
 * ALSO emitted as a machine-readable line:
 *
 *   [botforge:qr] 2@<b64>,<b64>,<b64>
 *
 * That raw string is what /api/services/:id/qr.png renders into a
 * scannable PNG. Without this hook, the raw QR string never reaches stdout
 * (bots only print ASCII art), making QR pairing over a web panel impossible.
 */

const Module = require('module');
const origLoad = Module._load;

let hooked = false;

Module._load = function (request, parent, isMain) {
  const mod = origLoad.apply(this, arguments);
  if (request === 'qrcode-terminal' && mod && !mod.__botforge_hooked) {
    try {
      const realGenerate = mod.generate ? mod.generate.bind(mod) : null;
      const wrapped = Object.create(mod);
      Object.defineProperty(wrapped, '__botforge_hooked', { value: true });
      if (realGenerate) {
        wrapped.generate = function (input, opts, cb) {
          try {
            // emit raw QR string BEFORE the ascii art
            process.stdout.write('\n[botforge:qr] ' + String(input) + '\n');
          } catch { /* ignore */ }
          return realGenerate(input, opts, cb);
        };
      }
      return wrapped;
    } catch { return mod; }
  }
  return mod;
};

// keep the shim quiet if required directly
hooked = true;
module.exports = { hooked };
