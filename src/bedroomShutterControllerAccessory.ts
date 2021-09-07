import { Service, PlatformAccessory, CharacteristicValue, PlatformConfig } from 'homebridge';

import { SmartHomeIntegrationPlatform } from './platform';

import * as mqtt from 'mqtt';

import { CategoryLogger } from './CategoryLogger';

export class BedroomShutterControllerAccessory {
  private readonly doorService: Service;
  private readonly windowService: Service;
  private readonly mqttClient: mqtt.Client;
  private readonly log: CategoryLogger;

  private states = {
    shutterUpTime: 0,
    shutterDownTime: 0,
    doorShutterPosition: 50,
    windowShutterPosition: 50,
  };

  constructor(
    private readonly platform: SmartHomeIntegrationPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly config: PlatformConfig,
  ) {
    this.log = new CategoryLogger(this.platform.log, 'BedroomShutterControllerAccessory');

    this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl);
    this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
    // this.mqttClient.on('message', this.handleIncomingMqttMessage.bind(this));

    this.doorService = this.accessory.getServiceById(this.platform.Service.WindowCovering, 'SMC-1')
      || this.accessory.addService(this.platform.Service.WindowCovering, 'Bedroom door shutters', 'SMC-1');

    this.doorService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    this.doorService.setCharacteristic(this.platform.Characteristic.Name, 'Bedroom door shutters');

    this.doorService.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(async () => {
        return this.states.doorShutterPosition;
      });

    this.doorService.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onGet(async () => {
        return this.states.doorShutterPosition;
      })
      .onSet(async (value: CharacteristicValue) => {
        const pos = value as number;
        this.states.doorShutterPosition = pos;
        this.setShutterPosition(pos, 1);
      });

    this.windowService = this.accessory.getServiceById(this.platform.Service.WindowCovering, 'SMC-2')
      || this.accessory.addService(this.platform.Service.WindowCovering, 'Bedroom window shutters', 'SMC-2');

    this.windowService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    this.windowService.setCharacteristic(this.platform.Characteristic.Name, 'Bedroom window shutters');

    this.windowService.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(async () => {
        return this.states.windowShutterPosition;
      });

    this.windowService.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onGet(async () => {
        return this.states.windowShutterPosition;
      })
      .onSet(async (value: CharacteristicValue) => {
        const pos = value as number;
        this.states.windowShutterPosition = pos;
        this.setShutterPosition(pos, 2);
      });
  }

  subscribeToMqttTopics(): void {
    this.log.info('subscribeToMqttTopics');
  }

  handleIncomingMqttMessage(topic: string, payload: Buffer): void {
    this.log.info(`handleIncomingMqttMessage: topic=${topic}, packet=${payload.toString()}`);
  }

  setShutterPosition(pos: number, shutterNumber: number): void {
    if (pos < 30) {
      this.mqttClient.publish(`smc/shutter/${shutterNumber}/down/set`, '1');
    } else if (pos > 70) {
      this.mqttClient.publish(`smc/shutter/${shutterNumber}/up/set`, '1');
    }
  }
}