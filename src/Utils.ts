import { SmartHomeIntegrationPlatform } from './platform';
import { CharacteristicValue } from 'homebridge';

export function toActiveValue(b: boolean, platform: SmartHomeIntegrationPlatform): CharacteristicValue {
  return b
    ? platform.Characteristic.Active.ACTIVE
    : platform.Characteristic.Active.INACTIVE;
}

export function toInUseValue(b: boolean, platform: SmartHomeIntegrationPlatform): CharacteristicValue {
  return b
    ? platform.Characteristic.InUse.IN_USE
    : platform.Characteristic.InUse.NOT_IN_USE;
}
