/* Copyright 2016 Streampunk Media Ltd

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

/* -LICENSE-START-
** Copyright (c) 2015 Blackmagic Design
**
** Permission is hereby granted, free of charge, to any person or organization
** obtaining a copy of the software and accompanying documentation covered by
** this license (the "Software") to use, reproduce, display, distribute,
** execute, and transmit the Software, and to prepare derivative works of the
** Software, and to permit third-parties to whom the Software is furnished to
** do so, all subject to the following:
**
** The copyright notices in the Software and this entire statement, including
** the above license grant, this restriction and the following disclaimer,
** must be included in all copies of the Software, in whole or in part, and
** all derivative works of the Software, unless such copies or derivative
** works are solely in the form of machine-executable object code generated by
** a source language processor.
**
** THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
** IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
** FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. IN NO EVENT
** SHALL THE COPYRIGHT HOLDERS OR ANYONE DISTRIBUTING THE SOFTWARE BE LIABLE
** FOR ANY DAMAGES OR OTHER LIABILITY, WHETHER IN CONTRACT, TORT OR OTHERWISE,
** ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
** DEALINGS IN THE SOFTWARE.
** -LICENSE-END-
*/

'use strict';
var os = require('os');
var isWinOrMac = (os.platform() === 'win32') || (os.platform() === 'darwin');
if (!isWinOrMac)
  throw('Macadam is not currently supported on this platform');

var bindings = require('bindings');
var macadamNative = bindings('macadam');
const util = require('util');
const EventEmitter = require('events');

var SegfaultHandler = require('../node-segfault-handler');
SegfaultHandler.registerHandler("crash.log");

function Capture (deviceIndex, displayMode, pixelFormat) {
  if (arguments.length !== 3 || typeof deviceIndex !== 'number' ||
      typeof displayMode !== 'number' || typeof pixelFormat !== 'number' ) {
    this.emit('error', new Error('Capture requires three number arguments: ' +
      'index, display mode and pixel format'));
  } else {
    this.capture = new macadamNative.Capture(deviceIndex, displayMode, pixelFormat);
  }
  EventEmitter.call(this);
}

util.inherits(Capture, EventEmitter);

Capture.prototype.start = function () {
  try {
    this.capture.init();
    this.capture.doCapture(function (x) {
      this.emit('frame', x);
    }.bind(this));
  } catch (err) {
    this.emit('error', err);
  }
}

Capture.prototype.stop = function () {
  try {
    this.capture.stop();
    this.emit('done');
  } catch (err) {
    this.emit('error', err);
  }
}

function Playback (deviceIndex, displayMode, pixelFormat) {
  if (arguments.length !== 3 || typeof deviceIndex !== 'number' ||
      typeof displayMode !== 'number' || typeof pixelFormat !== 'number' ) {
    this.emit('error', new Error('Playback requires three number arguments: ' +
      'index, display mode and pixel format'));
  } else {
    this.playback = new macadamNative.Playback(deviceIndex, displayMode, pixelFormat);
  }
  this.initialised = false;
  EventEmitter.call(this);
}

util.inherits(Playback, EventEmitter);

Playback.prototype.start = function () {
  try {
    if (!this.initialised) {
      console.log("*** playback.init", this.playback.init());
      this.initialised = true;
    }
    console.log("*** playback.doPlayback", this.playback.doPlayback(function (x) {
      this.emit('played', x);
    }.bind(this)));
  } catch (err) {
    this.emit('error', err);
  }
}

Playback.prototype.frame = function (f) {
  try {
    if (!this.initialised) {
      this.playback.init();
      this.initialised = true;
    }
    var result = this.playback.scheduleFrame(f);
    console.log("*** playback.scheduleFrame", result);
    if (typeof result === 'string')
      throw new Error("Problem scheduling frame: " + result);
    else
      return result;
  } catch (err) {
    this.emit('error', err);
  }
}

Playback.prototype.stop = function () {
  try {
    console.log('*** playback stop', this.playback.stop());
    this.emit('done');
  } catch (err) {
    this.emit('error', err);
  }
}

function bmCodeToInt (s) {
  return new Buffer(s.substring(0, 4)).readUInt32BE(0);
}

function intToBMCode(i) {
  var b = new Buffer(4).writeUInt32(i, 0);
  return b.toString();
}

function modeWidth (mode) {
  switch (mode) {
    case macadam.bmdModeNTSC:
    case macadam.bmdModeNTSC2398:
    case macadam.bmdModeNTSCp:
    case macadam.bmdModePAL:
    case macadam.bmdModePALp:
      return 720;
    case macadam.bmdModeHD720p50:
    case macadam.bmdModeHD720p5994:
    case macadam.bmdModeHD720p60:
      return 1280;
    case macadam.bmdModeHD1080p2398:
    case macadam.bmdModeHD1080p24:
    case macadam.bmdModeHD1080p25:
    case macadam.bmdModeHD1080p2997:
    case macadam.bmdModeHD1080p30:
    case macadam.bmdModeHD1080i50:
    case macadam.bmdModeHD1080i5994:
    case macadam.bmdModeHD1080i6000:
    case macadam.bmdModeHD1080p50:
    case macadam.bmdModeHD1080p5994:
    case macadam.bmdModeHD1080p6000:
      return 1920;
    case macadam.bmdMode2k2398:
    case macadam.bmdMode2k24:
    case macadam.bmdMode2k25:
    case macadam.bmdMode2kDCI2398:
    case macadam.bmdMode2kDCI24:
    case macadam.bmdMode2kDCI25:
      return 2048;
    case macadam.bmdMode4K2160p2398:
    case macadam.bmdMode4K2160p24:
    case macadam.bmdMode4K2160p25:
    case macadam.bmdMode4K2160p2997:
    case macadam.bmdMode4K2160p30:
    case macadam.bmdMode4K2160p50:
    case macadam.bmdMode4K2160p5994:
    case macadam.bmdMode4K2160p60:
      return 3840;
    case macadam.bmdMode4kDCI2398:
    case macadam.bmdMode4kDCI24:
    case macadam.bmdMode4kDCI25:
      return 4096;
    default:
      return 0;
  }
}

function modeHeight (mode) {
  switch (mode) {
    case macadam.bmdModeNTSC:
    case macadam.bmdModeNTSC2398:
    case macadam.bmdModeNTSCp:
        return 486;
    case macadam.bmdModePAL:
    case macadam.bmdModePALp:
      return 576;
    case macadam.bmdModeHD720p50:
    case macadam.bmdModeHD720p5994:
    case macadam.bmdModeHD720p60:
      return 720;
    case macadam.bmdModeHD1080p2398:
    case macadam.bmdModeHD1080p24:
    case macadam.bmdModeHD1080p25:
    case macadam.bmdModeHD1080p2997:
    case macadam.bmdModeHD1080p30:
    case macadam.bmdModeHD1080i50:
    case macadam.bmdModeHD1080i5994:
    case macadam.bmdModeHD1080i6000:
    case macadam.bmdModeHD1080p50:
    case macadam.bmdModeHD1080p5994:
    case macadam.bmdModeHD1080p6000:
      return 1080;
    case macadam.bmdMode2k2398:
    case macadam.bmdMode2k24:
    case macadam.bmdMode2k25:
      return 1556;
    case macadam.bmdMode2kDCI2398:
    case macadam.bmdMode2kDCI24:
    case macadam.bmdMode2kDCI25:
      return 1080;
    case macadam.bmdMode4K2160p2398:
    case macadam.bmdMode4K2160p24:
    case macadam.bmdMode4K2160p25:
    case macadam.bmdMode4K2160p2997:
    case macadam.bmdMode4K2160p30:
    case macadam.bmdMode4K2160p50:
    case macadam.bmdMode4K2160p5994:
    case macadam.bmdMode4K2160p60:
    case macadam.bmdMode4kDCI2398:
    case macadam.bmdMode4kDCI24:
    case macadam.bmdMode4kDCI25:
      return 2160;
    default:
      return 0;
  };
};

// Returns the duration of a frame as fraction of a second as an array:
//   [<enumverator>, [denominotor>]
function modeGrainDuration (mode) {
  switch (mode) {
    case macadam.bmdModeNTSC:
      return [1001, 30000];
    case macadam.bmdModeNTSC2398: // 3:2 pulldown applied on card
      return [1001, 30000];
    case macadam.bmdModeNTSCp:
      return [1001, 60000];
    case macadam.bmdModePAL:
      return [1000, 25000];
    case macadam.bmdModePALp:
      return [1000, 50000];
    case macadam.bmdModeHD720p50:
      return [1000, 50000];
    case macadam.bmdModeHD720p5994:
      return [1001, 60000];
    case macadam.bmdModeHD720p60:
      return [1000, 60000];
    case macadam.bmdModeHD1080p2398:
      return [1001, 24000];
    case macadam.bmdModeHD1080p24:
      return [1000, 24000];
    case macadam.bmdModeHD1080p25:
      return [1000, 25000];
    case macadam.bmdModeHD1080p2997:
      return [1001, 30000];
    case macadam.bmdModeHD1080p30:
      return [1000, 30000];
    case macadam.bmdModeHD1080i50:
      return [1000, 25000];
    case macadam.bmdModeHD1080i5994:
      return [1001, 60000];
    case macadam.bmdModeHD1080i6000:
      return [1000, 60000];
    case macadam.bmdModeHD1080p50:
      return [1000, 50000];
    case macadam.bmdModeHD1080p5994:
      return [1001, 60000];
    case macadam.bmdModeHD1080p6000:
      return [1000, 60000];
    case macadam.bmdMode2k2398:
      return [1001, 24000];
    case macadam.bmdMode2k24:
      return [1000, 24000];
    case macadam.bmdMode2k25:
      return [1000, 25000];
    case macadam.bmdMode2kDCI2398:
      return [1001, 24000];
    case macadam.bmdMode2kDCI24:
      return [1000, 24000];
    case macadam.bmdMode2kDCI25:
      return [1000, 25000];
    case macadam.bmdMode4K2160p2398:
      return [1001, 24000];
    case macadam.bmdMode4K2160p24:
      return [1000, 24000];
    case macadam.bmdMode4K2160p25:
      return [1000, 25000];
    case macadam.bmdMode4K2160p2997:
      return [1001, 30000];
    case macadam.bmdMode4K2160p30:
      return [1000, 30000];
    case macadam.bmdMode4K2160p50:
      return [1000, 50000];
    case macadam.bmdMode4K2160p5994:
      return [1001, 60000];
    case macadam.bmdMode4K2160p60:
      return [1000, 60000];
    case macadam.bmdMode4kDCI2398:
      return [1001, 24000];
    case macadam.bmdMode4kDCI24:
      return [1000, 24000];
    case macadam.bmdMode4kDCI25:
      return [1000, 25000];
    default:
    return [0, 1];
  };
};

function modeInterlace (mode) {
  switch (mode) {
    case macadam.bmdModeNTSC:
    case macadam.bmdModeNTSC2398:
      return true;
    case macadam.bmdModeNTSCp:
      return false;
    case macadam.bmdModePAL:
      return true;
    case macadam.bmdModePALp:
    case macadam.bmdModeHD720p50:
    case macadam.bmdModeHD720p5994:
    case macadam.bmdModeHD720p60:
    case macadam.bmdModeHD1080p2398:
    case macadam.bmdModeHD1080p24:
    case macadam.bmdModeHD1080p25:
    case macadam.bmdModeHD1080p2997:
    case macadam.bmdModeHD1080p30:
      return false;
    case macadam.bmdModeHD1080i50:
    case macadam.bmdModeHD1080i5994:
    case macadam.bmdModeHD1080i6000:
      return true;
    case macadam.bmdModeHD1080p50:
    case macadam.bmdModeHD1080p5994:
    case macadam.bmdModeHD1080p6000:
    case macadam.bmdMode2k2398:
    case macadam.bmdMode2k24:
    case macadam.bmdMode2k25:
    case macadam.bmdMode2kDCI2398:
    case macadam.bmdMode2kDCI24:
    case macadam.bmdMode2kDCI25:
    case macadam.bmdMode4K2160p2398:
    case macadam.bmdMode4K2160p24:
    case macadam.bmdMode4K2160p25:
    case macadam.bmdMode4K2160p2997:
    case macadam.bmdMode4K2160p30:
    case macadam.bmdMode4K2160p50:
    case macadam.bmdMode4K2160p5994:
    case macadam.bmdMode4K2160p60:
    case macadam.bmdMode4kDCI2398:
    case macadam.bmdMode4kDCI24:
    case macadam.bmdMode4kDCI25:
      return false;
    default:
      return false;
  }
}

function formatDepth (format) {
 switch (format) {
    case macadam.bmdFormat8BitYUV:
      return 8;
    case macadam.bmdFormat10BitYUV:
      return 10;
    case macadam.bmdFormat8BitARGB:
    case macadam.bmdFormat8BitBGRA:
      return 8;
    case macadam.bmdFormat10BitRGB:
      return 10;
    case macadam.bmdFormat12BitRGB:
    case macadam.bmdFormat12BitRGBLE:
      return 12;
    case macadam.bmdFormat10BitRGBXLE:
    case macadam.bmdFormat10BitRGBX:
      return 10;
    default:
      return 0;
  };
};

function formatFourCC (format) {
  switch (format) {
    case macadam.bmdFormat8BitYUV:
      return 'UYVY';
    case macadam.bmdFormat10BitYUV:
     return 'v210';
    case macadam.bmdFormat8BitARGB:
      return 'ARGB';
    case macadam.bmdFormat8BitBGRA:
      return 'BGRA';
  // Big-endian RGB 10-bit per component with SMPTE video levels (64-960). Packed as 2:10:10:10
    case macadam.bmdFormat10BitRGB:
      return 'r210';
  // Big-endian RGB 12-bit per component with full range (0-4095). Packed as 12-bit per component
    case macadam.bmdFormat12BitRGB:
      return 'R12B';
  // Little-endian RGB 12-bit per component with full range (0-4095). Packed as 12-bit per component
    case macadam.bmdFormat12BitRGBLE:
      return 'R12L';
  // Little-endian 10-bit RGB with SMPTE video levels (64-940)
    case macadam.bmdFormat10BitRGBXLE:
      return 'R10l';
  // Big-endian 10-bit RGB with SMPTE video levels (64-940)
    case macadam.bmdFormat10BitRGBX:
      return 'R10b';
  };
};

function formatSampling (format) {
  switch (format) {
    case macadam.bmdFormat8BitYUV:
      return 'YCbCr-4:2:2';
    case macadam.bmdFormat10BitYUV:
      return 'YCbCr-4:2:2';
    case macadam.bmdFormat8BitARGB:
      return 'ARGB';
    case macadam.bmdFormat8BitBGRA:
      return 'BGRA';
  // Big-endian RGB 10-bit per component with SMPTE video levels (64-960). Packed as 2:10:10:10
    case macadam.bmdFormat10BitRGB:
      return 'RGB';
  // Big-endian RGB 12-bit per component with full range (0-4095). Packed as 12-bit per component
    case macadam.bmdFormat12BitRGB:
      return 'RGB'
  // Little-endian RGB 12-bit per component with full range (0-4095). Packed as 12-bit per component
    case macadam.bmdFormat12BitRGBLE:
      return 'RGB';
  // Little-endian 10-bit RGB with SMPTE video levels (64-940)
    case macadam.bmdFormat10BitRGBXLE:
      return 'RGB';
  // Big-endian 10-bit RGB with SMPTE video levels (64-940)
    case macadam.bmdFormat10BitRGBX:
      return 'RGB';
    default:
      return '';
  };
};

function formatColorimetry (format) {
  switch (format) {
    case macadam.bmdFormat8BitYUV:
      return 'BT601-5';
    case macadam.bmdFormat10BitYUV:
      return 'BT709-2';
    case macadam.bmdFormat8BitARGB:
      return 'FULL';
    case macadam.bmdFormat8BitBGRA:
      return 'FULL';
  // Big-endian RGB 10-bit per component with SMPTE video levels (64-960). Packed as 2:10:10:10
    case macadam.bmdFormat10BitRGB:
      return 'SMPTE240M';
  // Big-endian RGB 12-bit per component with full range (0-4095). Packed as 12-bit per component
    case macadam.bmdFormat12BitRGB:
      return 'FULL';
  // Little-endian RGB 12-bit per component with full range (0-4095). Packed as 12-bit per component
    case macadam.bmdFormat12BitRGBLE:
      return 'FULL';
  // Little-endian 10-bit RGB with SMPTE video levels (64-940)
    case macadam.bmdFormat10BitRGBXLE:
      return 'SMPTE240M';
  // Big-endian 10-bit RGB with SMPTE video levels (64-940)
    case macadam.bmdFormat10BitRGBX:
      return 'SMPTE240M';
    default:
      return '';
  };
}

var macadam = {
  /* Enum BMDDisplayMode - Video display modes */
      /* SD Modes */
  bmdModeNTSC                     : bmCodeToInt('ntsc'),
  bmdModeNTSC2398                 : bmCodeToInt('nt23'),	// 3:2 pulldown
  bmdModePAL                      : bmCodeToInt('pal '),
  bmdModeNTSCp                    : bmCodeToInt('ntsp'),
  bmdModePALp                     : bmCodeToInt('palp'),
      /* HD 1080 Modes */
  bmdModeHD1080p2398              : bmCodeToInt('23ps'),
  bmdModeHD1080p24                : bmCodeToInt('24ps'),
  bmdModeHD1080p25                : bmCodeToInt('Hp25'),
  bmdModeHD1080p2997              : bmCodeToInt('Hp29'),
  bmdModeHD1080p30                : bmCodeToInt('Hp30'),
  bmdModeHD1080i50                : bmCodeToInt('Hi50'),
  bmdModeHD1080i5994              : bmCodeToInt('Hi59'),
  bmdModeHD1080i6000              : bmCodeToInt('Hi60'),	// N.B. This _really_ is 60.00 Hz.
  bmdModeHD1080p50                : bmCodeToInt('Hp50'),
  bmdModeHD1080p5994              : bmCodeToInt('Hp59'),
  bmdModeHD1080p6000              : bmCodeToInt('Hp60'),	// N.B. This _really_ is 60.00 Hz.
      /* HD 720 Modes */
  bmdModeHD720p50                 : bmCodeToInt('hp50'),
  bmdModeHD720p5994               : bmCodeToInt('hp59'),
  bmdModeHD720p60                 : bmCodeToInt('hp60'),
      /* 2k Modes */
  bmdMode2k2398                   : bmCodeToInt('2k23'),
  bmdMode2k24                     : bmCodeToInt('2k24'),
  bmdMode2k25                     : bmCodeToInt('2k25'),
      /* DCI Modes (output only) */
  bmdMode2kDCI2398                : bmCodeToInt('2d23'),
  bmdMode2kDCI24                  : bmCodeToInt('2d24'),
  bmdMode2kDCI25                  : bmCodeToInt('2d25'),
      /* 4k Modes */
  bmdMode4K2160p2398              : bmCodeToInt('4k23'),
  bmdMode4K2160p24                : bmCodeToInt('4k24'),
  bmdMode4K2160p25                : bmCodeToInt('4k25'),
  bmdMode4K2160p2997              : bmCodeToInt('4k29'),
  bmdMode4K2160p30                : bmCodeToInt('4k30'),
  bmdMode4K2160p50                : bmCodeToInt('4k50'),
  bmdMode4K2160p5994              : bmCodeToInt('4k59'),
  bmdMode4K2160p60                : bmCodeToInt('4k60'),
      /* DCI Modes (output only) */
  bmdMode4kDCI2398                : bmCodeToInt('4d23'),
  bmdMode4kDCI24                  : bmCodeToInt('4d24'),
  bmdMode4kDCI25                  : bmCodeToInt('4d25'),
      /* Special Modes */
  bmdModeUnknown                  : bmCodeToInt('iunk'),
  /* Enum BMDFieldDominance - Video field dominance */
  bmdUnknownFieldDominance        : 0,
  bmdLowerFieldFirst              : bmCodeToInt('lowr'),
  bmdUpperFieldFirst              : bmCodeToInt('uppr'),
  bmdProgressiveFrame             : bmCodeToInt('prog'),
  bmdProgressiveSegmentedFrame    : bmCodeToInt('psf '),
  /* Enum BMDPixelFormat - Video pixel formats supported for output/input */
  bmdFormat8BitYUV                : bmCodeToInt('2vuy'),
  bmdFormat10BitYUV               : bmCodeToInt('v210'),
  bmdFormat8BitARGB               : 32,
  bmdFormat8BitBGRA               : bmCodeToInt('BGRA'),
  // Big-endian RGB 10-bit per component with SMPTE video levels (64-960). Packed as 2:10:10:10
  bmdFormat10BitRGB               : bmCodeToInt('r210'),
  // Big-endian RGB 12-bit per component with full range (0-4095). Packed as 12-bit per component
  bmdFormat12BitRGB               : bmCodeToInt('R12B'),
  // Little-endian RGB 12-bit per component with full range (0-4095). Packed as 12-bit per component
  bmdFormat12BitRGBLE             : bmCodeToInt('R12L'),
  // Little-endian 10-bit RGB with SMPTE video levels (64-940)
  bmdFormat10BitRGBXLE            : bmCodeToInt('R10l'),
  // Big-endian 10-bit RGB with SMPTE video levels (64-940)
  bmdFormat10BitRGBX              : bmCodeToInt('R10b'),
  /* Enum BMDDisplayModeFlags - Flags to describe the characteristics of an IDeckLinkDisplayMode. */
  bmdDisplayModeSupports3D        : 1 << 0,
  bmdDisplayModeColorspaceRec601  : 1 << 1,
  bmdDisplayModeColorspaceRec709  : 1 << 2,
  // Convert to and from Black Magic codes.
  intToBMCode : intToBMCode,
  bmCodeToInt : bmCodeToInt,
  // Get parameters from modes and formats
  modeWidth : modeWidth,
  modeHeight : modeHeight,
  modeGrainDuration : modeGrainDuration,
  modeInterlace : modeInterlace,
  formatDepth : formatDepth,
  formatFourCC : formatFourCC,
  formatSampling : formatSampling,
  formatColorimetry : formatColorimetry,
  // access details about the currently connected devices
  deckLinkVersion : macadamNative.deckLinkVersion,
  getFirstDevice : macadamNative.getFirstDevice,
  // Raw access to device classes
  DirectCapture : macadamNative.Capture,
  Capture : Capture,
  Playback : Playback
};

module.exports = macadam;
