import { Service, PlatformAccessory, CharacteristicValue, PlatformConfig } from 'homebridge';
import { CategoryLogger } from './CategoryLogger';
import { SmartHomeIntegrationPlatform } from './platform';

import * as mqtt from 'mqtt';

export class DoorbellAccessory {
    private readonly service: Service;
    private readonly muteSwitchService: Service;
    private readonly mqttClient: mqtt.Client;
    private readonly log: CategoryLogger;

    private states = {
      ringing: false,
      ringerMuted: false,
    };

    constructor(
        private readonly platform: SmartHomeIntegrationPlatform,
        private readonly accessory: PlatformAccessory,
        private readonly config: PlatformConfig,
    ) {
      this.log = new CategoryLogger(
        this.platform.log,
        `${this.accessory.context.device.uniqueId}(${this.accessory.context.device.displayName})`,
      );

      this.log.debug(`connecting to MQTT broker: url=${this.config.mqttBrokerUrl}`);
      this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl, {
        username: this.config.mqttUsername,
        password: this.config.mqttPassword,
      });

      this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
      this.mqttClient.on('message', this.handleIncomingMqttMessage.bind(this));

      this.service = this.accessory.getService(this.platform.Service.MotionSensor)
        || this.accessory.addService(this.platform.Service.MotionSensor);

      this.setupMotionSensorService();

      this.muteSwitchService = this.accessory.getService('Mute')
        || this.accessory.addService(this.platform.Service.Switch, 'Mute');

      this.setupMuteSwitchService();
    }

    setupMotionSensorService(): void {
      this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

      this.service.getCharacteristic(this.platform.Characteristic.MotionDetected)
        .onGet(this.getRingingState.bind(this));

      this.service.addOptionalCharacteristic(this.platform.Characteristic.Name);
      this.service.setCharacteristic(this.platform.Characteristic.Name, 'Doorbell');
    }

    setupMuteSwitchService(): void {
      this.muteSwitchService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getMuteSwitchOn.bind(this))
        .onSet(this.setMuteSwitchOn.bind(this));
    }

    subscribeToMqttTopics(): void {
      this.log.debug('subscribeToMqttTopics');
      this.mqttClient.subscribe('doorphone/ringing');
      this.mqttClient.subscribe('doorphone/muted');
    }

    handleIncomingMqttMessage(topic: string, payload: Buffer): void {
      this.log.debug(`handleIncomingMqttMessage: topic=${topic}, packet=${payload.toString()}`);

      if (topic.toLowerCase() === 'doorphone/ringing') {
        this.states.ringing = Number.parseInt(payload.toString()) === 1;
        this.log.debug(`handleIncomingMqttMessage: ringing=${this.states.ringing}`);
        this.service.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.states.ringing);
      }

      if (topic.toLowerCase() === 'doorphone/muted') {
        this.states.ringerMuted = Number.parseInt(payload.toString()) === 1;
        this.log.debug(`handleIncomingMqttMessage: ringerMuted=${this.states.ringerMuted}`);
        this.muteSwitchService.updateCharacteristic(this.platform.Characteristic.On, this.states.ringerMuted);
      }
    }

    async getRingingState(): Promise<CharacteristicValue> {
      this.log.debug(`getRingingState: ${this.states.ringing}`);
      return this.states.ringing;
    }

    async getMuteSwitchOn(): Promise<CharacteristicValue> {
      this.log.debug(`getMuteSwitchOn: ${this.states.ringerMuted}`);
      return this.states.ringerMuted;
    }

    async setMuteSwitchOn(value: CharacteristicValue) {
      this.states.ringerMuted = value as boolean;
      this.log.debug(`setMuteSwitchOn: ${this.states.ringerMuted}`);

      this.mqttClient.publish('doorphone/mute', this.states.ringerMuted ? '1' : '0');
    }
}