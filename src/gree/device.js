const dgram = require('dgram');
const timers = require('timers');
const pack = require('./pack.js');
const events = require('./events.js');

const states = {
  IDLE: 0,
  WAIT_SCAN_RESULT: 1,
  DEVICE_FOUND: 2,
  WAIT_BIND_RESULT: 3,
  DEVICE_BOUND: 4,
  GETTING_DEVICE_STATUS: 5,
  WAIT_DEVICE_STATUS_RESULT: 6,
  WAIT_NEXT_SCAN: 7,
  WAIT_NEXT_BIND: 8,
  WAIT_NEXT_DEVICE_STATUS: 9,
};

function send_request(request, address, port) {
  return new Promise(resolve => {
    const socket = dgram.createSocket('udp4');

    socket.on('message', (msg) => {
    //   console.debug(`socket message: ${msg}`);
      timers.clearTimeout(socket_timeout);
      socket.close();
      resolve(JSON.parse(msg));
    });

    // console.debug(`sending request: ${request}`);
    socket.send(request, port, address);

    const socket_timeout = timers.setTimeout(() => {
    //   console.warn('socket timeout');
      socket.close();
      resolve(null);
    }, 2000);
  });
}

async function get_device_details(address, port = 7000) {
  const result = await send_request(JSON.stringify(pack.pack_create_scan()), address, port);

  if (result === null) {
    // console.warn('get_device_details: device not found');
    return undefined;
  }

  const decrypted = pack.pack_decrypt_generic(result.pack);
  //   console.debug(`get_device_details: pack=${JSON.stringify(decrypted)}`);

  return decrypted;
}

async function get_device_key(cid, address, port = 7000) {
  if (cid === undefined) {
    return undefined;
  }

  const result = await send_request(JSON.stringify(pack.pack_create_bind(cid)), address, port);

  const decrypted = pack.pack_decrypt_generic(result.pack);
  // console.debug(`get_device_key: pack=${JSON.stringify(decrypted)}`);

  if (decrypted['key'] === undefined) {
    // console.warn('get_device_key: invalid bind response, key not found');
    return undefined;
  }

  return decrypted['key'];
}

// async function get_device_param(cid, key, param, address, port) {
//   if (cid === undefined || param === undefined) {
//     return undefined;
//   }

//   const request_pack = pack.pack_create_get_param(cid, param);
//   const request = pack.pack_create_app_request(cid, pack.pack_encrypt(key, request_pack));
//   const result = await send_request(JSON.stringify(request), address, port);

//   const decrypted = pack.pack_decrypt(key, result.pack);
//   // console.debug(`get_device_param: pack=${JSON.stringify(decrypted)}`);

//   return decrypted.dat[0];
// }

async function get_device_multi_param(cid, key, params, address, port) {
  if (cid === undefined || params === undefined) {
    return undefined;
  }

  const request_pack = pack.pack_create_get_params(cid, params);
  const request = pack.pack_create_app_request(cid, pack.pack_encrypt(key, request_pack));
  const result = await send_request(JSON.stringify(request), address, port);

  if (!result) {
    return undefined;
  }

  const decrypted = pack.pack_decrypt(key, result.pack);
  // console.debug(`get_device_param: pack=${JSON.stringify(decrypted)}`);

  let results = {};

  let col = 0;
  decrypted.cols.forEach(param => {
    results[param] = decrypted.dat[col];
    ++col;
  });

  return results;
}

async function get_device_params(cid, key, address, port) {
  if (cid === undefined) {
    return undefined;
  }

  const param_keys = [
    'Pow',
    'Lig',
    'SetTem',
    'Tur',
    'TemSen',
    'Blo',
    'Quiet',
    'SwhSlp',
    'WdSpd',
    'Mod',
    'SwUpDn',
  ];

  const params = await get_device_multi_param(cid, key, param_keys, address, port);

  if (!params) {
    return undefined;
  }

  const result = {
    power_on: params.Pow === 1,
    led_on: params.Lig === 1,
    target_temp: params.SetTem,
    turbo_on: params.Tur === 1,
    sensor_temp: params.TemSen - 40,
    xfan_on: params.Blo === 1,
    quiet_on: params.Quiet === 1,
    sleep_on: params.SwhSlp === 1,
    fan_speed: params.WdSpd,
    mode: params.Mod,
    v_swing: params.SwUpDn,
  };

  // console.debug(`get_device_params: result=${JSON.stringify(result)}`);

  return result;
}

class Device extends events.Dispatcher {
    _state = states.IDLE;

    constructor(address, port = 7000) {
      super();

      this._address = address;
      this._port = port;

      // console.log(`Device: created, address=${this._address}, port=${this._port}`);

      this._taskInterval = timers.setInterval(this.task.bind(this), 100);
    }

    stop() {
      // console.log('Device: stopping');
      timers.clearInterval(this._taskInterval);
    }

    get_params() {
      return this._params;
    }

    task() {
      switch (this._state) {
        case states.IDLE:
          // console.log('Device: getting device details');

          this._next_scan_timeout = undefined;
          this._cid = undefined;

          get_device_details(this._address, this._port).then((details) => {
            if (details === undefined) {
              this._state = states.WAIT_NEXT_SCAN;
            } else {
              this._cid = details.cid;
              this._state = states.DEVICE_FOUND;
            }
          });

          this._state = states.WAIT_SCAN_RESULT;

          break;

        case states.WAIT_SCAN_RESULT:
          break;

        case states.DEVICE_FOUND:
          // console.log(`Device: device found, binding: cid=${this._cid}`);

          this._next_bind_timeout = undefined;
          this._key = undefined;

          get_device_key(this._cid, this._address, this._port).then((key) => {
            if (key === undefined) {
              this._state = states.WAIT_NEXT_BIND;
            } else {
              this._key = key;
              this._state = states.DEVICE_BOUND;
            }
          });

          this._state = states.WAIT_BIND_RESULT;

          break;

        case states.WAIT_BIND_RESULT:
          break;

        case states.DEVICE_BOUND:
          this._state = states.GETTING_DEVICE_STATUS;
          break;

        case states.GETTING_DEVICE_STATUS:
          // console.log(`Device: getting status, cid=${this._cid}`);

          this._next_status_request_timeout = undefined;

          get_device_params(this._cid, this._key, this._address, this._port).then((params) => {
            if (params === undefined) {
              this._state = states.IDLE;
            }

            this._params = params;
            this._state = states.WAIT_NEXT_DEVICE_STATUS;

            this.dispatch('params', this._params);
          });

          this._state = states.WAIT_DEVICE_STATUS_RESULT;

          break;

        case states.WAIT_NEXT_SCAN:
          if (this._next_scan_timeout !== undefined) {
            break;
          }

          // console.log('Device: device not found, waiting for next scan');

          this._next_scan_timeout = timers.setTimeout(() => {
            this._state = states.IDLE;
          }, 2000);

          break;

        case states.WAIT_NEXT_BIND:
          if (this._next_bind_timeout !== undefined) {
            break;
          }

          // console.log('Device: cannot get device key, waiting for next bind');

          this._next_bind_timeout = timers.setTimeout(() => {
            this._state = states.DEVICE_FOUND;
          }, 2000);

          break;

        case states.WAIT_NEXT_DEVICE_STATUS:
          if (this._next_status_request_timeout !== undefined) {
            break;
          }

          this._next_status_request_timeout = timers.setTimeout(() => {
            this._state = states.GETTING_DEVICE_STATUS;
          }, 2000);

          break;
      }
    }
}
exports.Device = Device;