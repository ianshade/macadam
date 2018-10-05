/* Copyright 2018 Streampunk Media Ltd.

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

#define _WINSOCKAPI_

#include "DeckLinkAPI.h"
#include <stdio.h>

#ifdef WIN32
#include <tchar.h>
#include <conio.h>
#include <objbase.h>		// Necessary for COM
#include <comdef.h>
#endif

#include "macadam_util.h"
#include "node_api.h"

napi_value deckLinkVersion(napi_env env, napi_callback_info info) {
  napi_status status;
  napi_value result;

  IDeckLinkIterator* deckLinkIterator;
  HRESULT hresult;
  IDeckLinkAPIInformation*	deckLinkAPIInformation;
  #ifdef WIN32
  CoCreateInstance(CLSID_CDeckLinkIterator, NULL, CLSCTX_ALL, IID_IDeckLinkIterator, (void**)&deckLinkIterator);
  #else
  deckLinkIterator = CreateDeckLinkIteratorInstance();
  #endif

  hresult = deckLinkIterator->QueryInterface(IID_IDeckLinkAPIInformation, (void**)&deckLinkAPIInformation);
  if (hresult != S_OK) NAPI_THROW_ERROR("Error connecting to DeckLinkAPI.");

  char deckVer [80];
  int64_t	deckLinkVersion;
  int	dlVerMajor, dlVerMinor, dlVerPoint;

  // We can also use the BMDDeckLinkAPIVersion flag with GetString
  deckLinkAPIInformation->GetInt(BMDDeckLinkAPIVersion, &deckLinkVersion);

  dlVerMajor = (deckLinkVersion & 0xFF000000) >> 24;
  dlVerMinor = (deckLinkVersion & 0x00FF0000) >> 16;
  dlVerPoint = (deckLinkVersion & 0x0000FF00) >> 8;

  sprintf(deckVer, "DeckLinkAPI version: %d.%d.%d", dlVerMajor, dlVerMinor, dlVerPoint);

  deckLinkAPIInformation->Release();
  deckLinkIterator->Release();

  status = napi_create_string_utf8(env, deckVer, NAPI_AUTO_LENGTH, &result);
  CHECK_STATUS;
  return result;
}

#define CHECK_RELEASE if (checkStatus(env, status, __FILE__, __LINE__ - 1) != napi_ok) { \
  deckLink->Release(); \
  deckLinkIterator->Release(); \
  if (deckLinkAttributes != nullptr) deckLinkAttributes->Release(); \
  return nullptr; \
}

napi_value getFirstDevice(napi_env env, napi_callback_info info) {
  napi_status status;
  napi_value result;

  status = napi_get_undefined(env, &result);
  CHECK_STATUS;

  IDeckLinkIterator* deckLinkIterator;
  HRESULT	hresult;
  IDeckLink* deckLink;
  IDeckLinkAttributes* deckLinkAttributes = nullptr;

  #ifdef WIN32
  CoCreateInstance(CLSID_CDeckLinkIterator, NULL, CLSCTX_ALL, IID_IDeckLinkIterator, (void**)&deckLinkIterator);
  #else
  deckLinkIterator = CreateDeckLinkIteratorInstance();
  #endif
  if (deckLinkIterator->Next(&deckLink) != S_OK) {
    status = napi_get_undefined(env, &result);
    if (checkStatus(env, status, __FILE__, __LINE__ - 1) != napi_ok) {
      deckLinkIterator->Release();
      return result;
    }
  }

  #ifdef WIN32
  BSTR deviceNameBSTR = NULL;
  hresult = deckLink->GetModelName(&deviceNameBSTR);
  if (hresult == S_OK) {
    _bstr_t deviceName(deviceNameBSTR, false);
    status = napi_create_string_utf8(env, (char*) deviceName, NAPI_AUTO_LENGTH, &result);
    // delete deviceName;
    CHECK_RELEASE;
  }
  #elif __APPLE__
  CFStringRef deviceNameCFString = NULL;
  hresult = deckLink->GetModelName(&deviceNameCFString);
  if (hresult == S_OK) {
    char deviceName [64];
    CFStringGetCString(deviceNameCFString, deviceName, sizeof(deviceName), kCFStringEncodingMacRoman);
    CFRelease(deviceNameCFString);
    status = napi_create_string_utf8(env, deviceName, NAPI_AUTO_LENGTH, &result);
    CHECK_RELEASE;
  }
  #else
  const char* deviceName;
  hresult = deckLink->GetModelName(&deviceName);
  if (hresult == S_OK) {
    status = napi_create_string_utf8(env, deviceName, NAPI_AUTO_LENGTH, &result);
    free(deviceName);
    CHECK_RELEASE;
  }
  #endif

  deckLink->Release();
  deckLinkIterator->Release();

  return result;
}

napi_value getDeviceInfo(napi_env env, napi_callback_info info) {
  napi_status status;
  napi_value result;

  status = napi_create_array(env, &result);
  CHECK_STATUS;

  IDeckLinkIterator* deckLinkIterator;
  HRESULT	hresult;
  IDeckLink* deckLink;
  IDeckLinkAttributes* deckLinkAttributes = nullptr;
  #ifdef WIN32
  CoCreateInstance(CLSID_CDeckLinkIterator, NULL, CLSCTX_ALL, IID_IDeckLinkIterator, (void**)&deckLinkIterator);
  #else
  deckLinkIterator = CreateDeckLinkIteratorInstance();
  #endif

  uint32_t index = 0;
  while (deckLinkIterator->Next(&deckLink) == S_OK) {
    napi_value item, param = nullptr;
    status = napi_create_object(env, &item);
    CHECK_RELEASE;
    #ifdef WIN32
    BSTR deviceNameBSTR = NULL;
    hresult = deckLink->GetModelName(&deviceNameBSTR);
    if (hresult == S_OK) {
      _bstr_t deviceName(deviceNameBSTR, false);
      status = napi_create_string_utf8(env, (char*) deviceName, NAPI_AUTO_LENGTH, &param);
      // delete deviceName;
      CHECK_RELEASE;
    }
    #elif __APPLE__
    CFStringRef deviceNameCFString = NULL;
    hresult = deckLink->GetModelName(&deviceNameCFString);
    if (hresult == S_OK) {
      char deviceName [64];
      CFStringGetCString(deviceNameCFString, deviceName, sizeof(deviceName), kCFStringEncodingMacRoman);
      CFRelease(deviceNameCFString);
      status = napi_create_string_utf8(env, deviceName, NAPI_AUTO_LENGTH, &param);
      CHECK_RELEASE;
    }
    #else
    const char* deviceName;
    hresult = deckLink->GetModelName(&deviceName);
    if (hresult == S_OK) {
      status = napi_create_string_utf8(env, deviceName, NAPI_AUTO_LENGTH, &param);
      free(deviceName);
      CHECK_RELEASE;
    }
    #endif
    if (param != nullptr) {
      status = napi_set_named_property(env, item, "modelName", param);
      CHECK_RELEASE;
    }
    param = nullptr;

    #ifdef WIN32
    BSTR displayNameBSTR = NULL;
    hresult = deckLink->GetDisplayName(&displayNameBSTR);
    if (hresult == S_OK) {
      _bstr_t displayName(deviceNameBSTR, false);
      status = napi_create_string_utf8(env, (char*) displayName, NAPI_AUTO_LENGTH, &param);
      // delete displayName;
      CHECK_RELEASE;
    }
    #elif __APPLE__
    CFStringRef displayNameCFString = NULL;
    hresult = deckLink->GetDisplayName(&displayNameCFString);
    if (hresult == S_OK) {
      char displayName [64];
      CFStringGetCString(displayNameCFString, displayName, sizeof(displayName), kCFStringEncodingMacRoman);
      CFRelease(displayNameCFString);
      status = napi_create_string_utf8(env, displayName, NAPI_AUTO_LENGTH, &param);
      CHECK_RELEASE;
    }
    #else
    const char* displayName;
    hresult = deckLink->GetDisplayName(&displayName);
    if (hresult == S_OK) {
      status = napi_create_string_utf8(env, displayName, NAPI_AUTO_LENGTH, &param);
      free(displayName);
      CHECK_RELEASE;
    }
    #endif
    if (param != nullptr) {
      status = napi_set_named_property(env, item, "displayName", param);
      CHECK_RELEASE;
    }
    param = nullptr;

    // Query the DeckLink for its attributes interface
    hresult = deckLink->QueryInterface(IID_IDeckLinkAttributes, (void**)&deckLinkAttributes);
    if (hresult == S_OK) {
      #ifdef WIN32
      BOOL supported;
      BSTR name;
      #elif __APPLE__
      bool supported;
      CFStringRef name;
      #else
      bool supported;
      const char* name;
      #endif
      int64_t value;

      hresult = deckLinkAttributes->GetFlag(BMDDeckLinkHasSerialPort, &supported);
      if (hresult == S_OK) {
        status = napi_get_boolean(env, supported, &param);
        CHECK_RELEASE;
        status = napi_set_named_property(env, item, "hasSerialPort", param);
        CHECK_RELEASE;
        if (supported == true) {
          hresult = deckLinkAttributes->GetString(BMDDeckLinkSerialPortDeviceName, &name);
          if (hresult == S_OK) {
            #ifdef WIN32
            _bstr_t portName(deviceNameBSTR, false);
            status = napi_create_string_utf8(env, (char*) portName, NAPI_AUTO_LENGTH, &param);
            // delete portName;
            CHECK_RELEASE;
            #elif __APPLE__
            char portName[64];
            CFStringGetCString(name, portName, sizeof(portName), kCFStringEncodingMacRoman);
            CFRelease(name);
            status = napi_create_string_utf8(env, portName, NAPI_AUTO_LENGTH, &param);
            CHECK_RELEASE;
            #else
            status = napi_create_string_utf8(env, name, NAPI_AUTO_LENGTH, &param);
            free(name);
            CHECK_RELEASE;
            #endif
            status = napi_set_named_property(env, item, "serialPortDeviceName", param);
            CHECK_RELEASE;
          }
        }
      }

      hresult = deckLinkAttributes->GetInt(BMDDeckLinkPersistentID, &value);
      if (hresult == S_OK) {
        status = napi_create_int64(env, value, &param);
        CHECK_RELEASE;
        status = napi_set_named_property(env, item, "persistentID", param);
        CHECK_RELEASE;
      }

      hresult = deckLinkAttributes->GetInt(BMDDeckLinkTopologicalID, &value);
      if (hresult == S_OK) {
        status = napi_create_int64(env, value, &param);
        CHECK_RELEASE;
        status = napi_set_named_property(env, item, "topologicalID", param);
        CHECK_RELEASE;
      }

      hresult = deckLinkAttributes->GetInt(BMDDeckLinkNumberOfSubDevices, &value);
      if (hresult == S_OK) {
        status = napi_create_int64(env, value, &param);
        CHECK_RELEASE;
        status = napi_set_named_property(env, item, "numberOfSubDevices", param);
        CHECK_RELEASE;
      }

      if (value > 0) {
        hresult = deckLinkAttributes->GetInt(BMDDeckLinkSubDeviceIndex, &value);
        if (hresult == S_OK) {
          status = napi_create_int64(env, value, &param);
          CHECK_RELEASE;
          status = napi_set_named_property(env, item, "subDeviceIndex", param);
          CHECK_RELEASE;
        }
      }

      hresult = deckLinkAttributes->GetInt(BMDDeckLinkMaximumAudioChannels, &value);
      if (hresult == S_OK) {
        status = napi_create_int64(env, value, &param);
        CHECK_RELEASE;
        status = napi_set_named_property(env, item, "maximumAudioChannels", param);
        CHECK_RELEASE;
      }

      hresult = deckLinkAttributes->GetFlag(BMDDeckLinkSupportsInputFormatDetection, &supported);
  	  if (hresult == S_OK) {
        status = napi_get_boolean(env, supported, &param);
        CHECK_RELEASE;
        status = napi_set_named_property(env, item, "supportsInputFormatDetection", param);
        CHECK_RELEASE;
      }

      hresult = deckLinkAttributes->GetFlag(BMDDeckLinkSupportsFullDuplex, &supported);
      if (hresult == S_OK) {
        status = napi_get_boolean(env, supported, &param);
        CHECK_RELEASE;
        status = napi_set_named_property(env, item, "supportsFullDuplex", param);
        CHECK_RELEASE;
      }

      hresult = deckLinkAttributes->GetFlag(BMDDeckLinkSupportsExternalKeying, &supported);
  	  if (hresult == S_OK) {
        status = napi_get_boolean(env, supported, &param);
        CHECK_RELEASE;
        status = napi_set_named_property(env, item, "supportsExternalKeying", param);
        CHECK_RELEASE;
      }

      hresult = deckLinkAttributes->GetFlag(BMDDeckLinkSupportsInternalKeying, &supported);
  	  if (hresult == S_OK) {
        status = napi_get_boolean(env, supported, &param);
        CHECK_RELEASE;
        status = napi_set_named_property(env, item, "supportsInernalKeying", param);
        CHECK_RELEASE;
      }

      hresult = deckLinkAttributes->GetFlag(BMDDeckLinkSupportsHDKeying, &supported);
  	  if (hresult == S_OK) {
        status = napi_get_boolean(env, supported, &param);
        CHECK_RELEASE;
        status = napi_set_named_property(env, item, "supportsHDKeying", param);
        CHECK_RELEASE;
      }

      hresult = deckLinkAttributes->GetInt(BMDDeckLinkDeviceInterface, &value);
      if (hresult == S_OK) {
        switch (value) {
          case bmdDeviceInterfacePCI:
            status = napi_create_string_utf8(env, "PCI", NAPI_AUTO_LENGTH, &param);
            CHECK_RELEASE;
            break;
          case bmdDeviceInterfaceUSB:
            status = napi_create_string_utf8(env, "USB", NAPI_AUTO_LENGTH, &param);
            CHECK_RELEASE;
            break;
          case bmdDeviceInterfaceThunderbolt:
            status = napi_create_string_utf8(env, "Thunderbolt", NAPI_AUTO_LENGTH, &param);
            CHECK_RELEASE;
            break;
        }

        status = napi_set_named_property(env, item, "deviceInterface", param);
        CHECK_RELEASE;
      }

      hresult = deckLinkAttributes->GetInt(BMDDeckLinkVideoOutputConnections, &value);
      if (hresult == S_OK) {
        napi_value conna, conni;
        uint32_t indexo = 0;
        status = napi_create_array(env, &conna);
        CHECK_RELEASE;

        if (value & bmdVideoConnectionSDI) {
          status = napi_create_string_utf8(env, "SDI", NAPI_AUTO_LENGTH, &conni);
          CHECK_RELEASE;
          status = napi_set_element(env, conna, indexo++, conni);
          CHECK_RELEASE;
        }

        if (value & bmdVideoConnectionHDMI) {
          status = napi_create_string_utf8(env, "HDMI", NAPI_AUTO_LENGTH, &conni);
          CHECK_RELEASE;
          status = napi_set_element(env, conna, indexo++, conni);
          CHECK_RELEASE;
        }

        if (value & bmdVideoConnectionOpticalSDI) {
          status = napi_create_string_utf8(env, "Optical SDI", NAPI_AUTO_LENGTH, &conni);
          CHECK_RELEASE;
          status = napi_set_element(env, conna, indexo++, conni);
          CHECK_RELEASE;
        }

        if (value & bmdVideoConnectionComponent) {
          status = napi_create_string_utf8(env, "Component", NAPI_AUTO_LENGTH, &conni);
          CHECK_RELEASE;
          status = napi_set_element(env, conna, indexo++, conni);
          CHECK_RELEASE;
        }

        if (value & bmdVideoConnectionComposite){
          status = napi_create_string_utf8(env, "Composite", NAPI_AUTO_LENGTH, &conni);
          CHECK_RELEASE;
          status = napi_set_element(env, conna, indexo++, conni);
          CHECK_RELEASE;
        }

        if (value & bmdVideoConnectionSVideo) {
          status = napi_create_string_utf8(env, "S-Video", NAPI_AUTO_LENGTH, &conni);
          CHECK_RELEASE;
          status = napi_set_element(env, conna, indexo++, conni);
          CHECK_RELEASE;
        }

        status = napi_set_named_property(env, item, "videoOutputConnections", conna);
        CHECK_RELEASE;
      }

      hresult = deckLinkAttributes->GetInt(BMDDeckLinkVideoInputConnections, &value);
      if (hresult == S_OK) {
        napi_value connb, connj;
        uint32_t indexi = 0;
        status = napi_create_array(env, &connb);
        CHECK_RELEASE;

        if (value & bmdVideoConnectionSDI) {
          status = napi_create_string_utf8(env, "SDI", NAPI_AUTO_LENGTH, &connj);
          CHECK_RELEASE;
          status = napi_set_element(env, connb, indexi++, connj);
          CHECK_RELEASE;
        }

        if (value & bmdVideoConnectionHDMI) {
          status = napi_create_string_utf8(env, "HDMI", NAPI_AUTO_LENGTH, &connj);
          CHECK_RELEASE;
          status = napi_set_element(env, connb, indexi++, connj);
          CHECK_RELEASE;
        }

        if (value & bmdVideoConnectionOpticalSDI) {
          status = napi_create_string_utf8(env, "Optical SDI", NAPI_AUTO_LENGTH, &connj);
          CHECK_RELEASE;
          status = napi_set_element(env, connb, indexi++, connj);
          CHECK_RELEASE;
        }

        if (value & bmdVideoConnectionComponent) {
          status = napi_create_string_utf8(env, "Component", NAPI_AUTO_LENGTH, &connj);
          CHECK_RELEASE;
          status = napi_set_element(env, connb, indexi++, connj);
          CHECK_RELEASE;
        }

        if (value & bmdVideoConnectionComposite){
          status = napi_create_string_utf8(env, "Composite", NAPI_AUTO_LENGTH, &connj);
          CHECK_RELEASE;
          status = napi_set_element(env, connb, indexi++, connj);
          CHECK_RELEASE;
        }

        if (value & bmdVideoConnectionSVideo) {
          status = napi_create_string_utf8(env, "S-Video", NAPI_AUTO_LENGTH, &connj);
          CHECK_RELEASE;
          status = napi_set_element(env, connb, indexi++, connj);
          CHECK_RELEASE;
        }

        status = napi_set_named_property(env, item, "videoInputConnections", connb);
        CHECK_RELEASE;
      }

      deckLinkAttributes->Release();
      deckLinkAttributes = nullptr;
    } // Get deckLinkAttributes

    status = napi_set_element(env, result, index++, item);
    CHECK_RELEASE;

    deckLink->Release();
  }

  deckLinkIterator->Release();

  return result;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_status status;
  napi_property_descriptor desc[] = {
    DECLARE_NAPI_METHOD("deckLinkVersion", deckLinkVersion),
    DECLARE_NAPI_METHOD("getFirstDevice", getFirstDevice),
    DECLARE_NAPI_METHOD("getDeviceInfo", getDeviceInfo)
   };
  status = napi_define_properties(env, exports, 3, desc);
  CHECK_STATUS;

  #ifdef WIN32
  HRESULT result;
  result = CoInitialize(NULL);
	if (FAILED(result))
	{
		fprintf(stderr, "Initialization of COM failed - result = %08x.\n", result);
	}
  #endif

  return exports;
}

NAPI_MODULE(nodencl, Init)
