const buffer = require('buffer');
const crypto = require('crypto');

const algorithm = 'aes-128-ecb';
const generic_key = 'a3K8Bx%2r8Y7#xDh';

function _pad_string(s) {
  const length = 16 - (s.length % 16);
  return s + String.fromCharCode(length).repeat(length);
}

function _unpad_string(s) {
  const padding_len = s.charCodeAt(s.length - 1);
  if (padding_len > 15) {
    return s;
  }
  return s.substring(0, s.length - padding_len);
}

exports.pack_encrypt = function(key, detail) {
  const json = JSON.stringify(detail);
  const padded = _pad_string(json);
  const cipher = crypto.createCipheriv(algorithm, key, null);
  let encrypted = cipher.update(padded).toString('hex');
  encrypted += cipher.final().toString('hex');
  const encoded = buffer.Buffer.from(encrypted, 'hex').toString('base64');
  return encoded;
};

exports.pack_encrypt_generic = function(detail) {
  return this.pack_encrypt(generic_key, detail);
};

exports.pack_decrypt = function(key, encoded) {
  const decoded = buffer.Buffer.from(encoded, 'base64');
  const cipher = crypto.createDecipheriv(algorithm, key, null);
  let decrypted = cipher.update(decoded).toString('utf8');
  decrypted += cipher.final();
  decrypted = _unpad_string(decrypted);
  return JSON.parse(decrypted);
};

exports.pack_decrypt_generic = function(encoded) {
  return this.pack_decrypt(generic_key, encoded);
};

exports.pack_create_scan = function() {
  return {
    t: 'scan',
  };
};

exports.pack_create_bind = function(cid) {
  return {
    t: 'bind',
    mac: cid,
    uid: 0,
  };
};

exports.pack_create_get_param = function(cid, param) {
  return {
    cols: [ param ],
    mac: cid,
    t: 'status',
  };
};

exports.pack_create_get_params = function(cid, params) {
  return {
    cols: params,
    mac: cid,
    t: 'status',
  };
};

exports.pack_create_app_request = function(cid, pack, uid = 0, i = 0) {
  return {
    cid: 'app',
    i: i,
    pack: pack,
    t: 'pack',
    tcid: cid,
    uid: uid,
  };
};

exports.pack_create_set_param = function(param, value) {
  return {
    opt: [ param ],
    p: [ value ],
    t: 'cmd',
  };
};

exports.pack_create_set_params = function(params, values) {
  return {
    opt: params,
    p: values,
    t: 'cmd',
  };
};