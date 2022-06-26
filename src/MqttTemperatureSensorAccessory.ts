import { SmartHomeIntegrationPlatform } from './platform';
import * as mqtt from 'mqtt';
import { PlatformAccessory } from 'homebridge';
import { MqttSensorAccessory, SensorValueConversionFunction } from './MqttSensorAccessory';

export class MqttTemperatureSensorAccessory extends MqttSensorAccessory {
  constructor(
    topic: string,
    platform: SmartHomeIntegrationPlatform,
    accessory: PlatformAccessory,
    mqttClient: mqtt.Client,
    converter: SensorValueConversionFunction = (value: number) => value,
  ) {
    super(
      platform.Service.TemperatureSensor,
      topic,
      platform,
      accessory,
      mqttClient,
      converter,
    );
  }

  protected setupService(): void {
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(async () => {
        return this.states.currentValue;
      });
  }

  protected currentValueUpdated(): void {
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentTemperature,
      this.states.currentValue,
    );
  }
}