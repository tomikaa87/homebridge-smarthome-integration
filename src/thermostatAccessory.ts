import { Service, PlatformAccessory, CharacteristicValue, Logger, PlatformConfig } from 'homebridge';

import { SmartHomeIntegrationPlatform } from './platform';

import * as mqtt from 'mqtt';

export class ThermostatAccessory {
    private readonly service: Service;
    private readonly boostSwitchService: Service;
    private readonly mqttClient: mqtt.Client;
    private readonly log: Logger;

    private states = {
      currentTemperature: 0,
      targetTemperature: 0,
      heatingActive: false,
      boostActive: false,
      heatingMode: 0,
    };

    constructor(
        private readonly platform: SmartHomeIntegrationPlatform,
        private readonly accessory: PlatformAccessory,
        private readonly config: PlatformConfig,
    ) {
      this.log = platform.log;

      this.log.info(`connecting to MQTT broker: url=${this.config.mqttBrokerUrl}`);
      this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl, {
        username: this.config.mqttUsername,
        password: this.config.mqttPassword,
      });

      this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
      this.mqttClient.on('message', this.handleIncomingMqttMessage.bind(this));

      this.service = this.accessory.getService(this.platform.Service.Thermostat)
        || this.accessory.addService(this.platform.Service.Thermostat);

      this.setupThermostatService();

      this.boostSwitchService = this.accessory.getService('Boost')
        || this.accessory.addService(this.platform.Service.Switch, 'Boost');

      this.setupBoostSwitchService();
    }

    setupThermostatService(): void {
      this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

      this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getCurrentTemperature.bind(this));

      this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
        .onGet(this.getTargetTemperature.bind(this))
        .onSet(this.setTargetTemperature.bind(this));

      this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
        .onGet(this.getCurrentHeatingState.bind(this));

      this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
        .onGet(this.getTargetHeatingState.bind(this))
        .onSet(this.setTargetHeatingState.bind(this));
    }

    setupBoostSwitchService(): void {
      this.boostSwitchService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getBoostSwitchOn.bind(this))
        .onSet(this.setBoostSwitchOn.bind(this));
    }

    subscribeToMqttTopics(): void {
      this.log.debug('subscribeToMqttTopics');
      this.mqttClient.subscribe('thermostat/temp/current');
      this.mqttClient.subscribe('thermostat/temp/active');
      this.mqttClient.subscribe('thermostat/heating/active');
      this.mqttClient.subscribe('thermostat/heating/mode');
      this.mqttClient.subscribe('thermostat/boost/active');
    }

    handleIncomingMqttMessage(topic: string, payload: Buffer): void {
      this.log.debug(`handleIncomingMqttMessage: topic=${topic}, packet=${payload.toString()}`);

      if (topic.toLowerCase() === 'thermostat/temp/current') {
        this.states.currentTemperature = Number.parseFloat(payload.toString());
        this.log.debug(`handleIncomingMqttMessage: currentTemperature=${this.states.currentTemperature}`);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.states.currentTemperature);
      }

      if (topic.toLowerCase() === 'thermostat/temp/active') {
        this.states.targetTemperature = Number.parseFloat(payload.toString());
        this.log.debug(`handleIncomingMqttMessage: targetTemperature=${this.states.targetTemperature}`);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, this.states.targetTemperature);
      }

      if (topic.toLowerCase() === 'thermostat/heating/active') {
        this.states.heatingActive = Number.parseInt(payload.toString()) === 1;
        this.log.debug(`handleIncomingMqttMessage: heatingActive=${this.states.heatingActive}`);
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentHeatingCoolingState,
          this.getHeatingState(this.states.heatingActive),
        );
      }

      if (topic.toLowerCase() === 'thermostat/heating/mode') {
        this.states.heatingMode = Number.parseInt(payload.toString());
        this.log.debug(`handleIncomingMqttMessage: heatingMode=${this.states.heatingMode}`);
        const state = this.getTargetHeatingStateFromMode(this.states.heatingMode);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, state);
      }

      if (topic.toLowerCase() === 'thermostat/boost/active') {
        this.states.boostActive = Number.parseInt(payload.toString()) === 1;
        this.log.debug(`handleIncomingMqttMessage: boostActive=${this.states.boostActive}`);
        this.boostSwitchService.updateCharacteristic(this.platform.Characteristic.On, this.states.boostActive);
      }
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
      this.log.debug(`getCurrentTemperature: ${this.states.currentTemperature} C`);
      return this.states.currentTemperature;
    }

    async getTargetTemperature(): Promise<CharacteristicValue> {
      this.log.debug(`getTargetTemperature: ${this.states.targetTemperature}`);
      return this.states.targetTemperature;
    }

    async setTargetTemperature(value: CharacteristicValue) {
      this.states.targetTemperature = value as number;
      this.log.debug(`setTargetTemperature: ${this.states.targetTemperature}`);

      this.mqttClient.publish('thermostat/temp/active/set', this.states.targetTemperature.toString());
    }

    async getCurrentHeatingState(): Promise<CharacteristicValue> {
      this.log.debug(`getCurrentHeatingState: ${this.states.heatingActive}`);
      return this.getHeatingState(this.states.heatingActive);
    }

    async setTargetHeatingState(value: CharacteristicValue) {
      const allowedState = this.getAllowedTargetHeatingState(value);

      if (allowedState !== value) {
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, allowedState);
      }

      this.states.heatingMode = this.getHeatingModeFromTargetState(allowedState);
      this.log.debug(`setHeatingMode: ${this.states.heatingMode}`);

      this.mqttClient.publish('thermostat/heating/mode/set', this.states.heatingMode.toString());
    }

    async getTargetHeatingState(): Promise<CharacteristicValue> {
      this.log.debug(`getTargetHeatingState: ${this.states.heatingMode}`);
      const state = this.getTargetHeatingStateFromMode(this.states.heatingMode);
      return state;
    }

    getHeatingState(heatingActive: boolean): CharacteristicValue {
      return heatingActive
        ? this.platform.Characteristic.CurrentHeatingCoolingState.HEAT
        : this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    }

    getTargetHeatingStateFromMode(mode: number) {
      return mode === 2
        ? this.platform.Characteristic.TargetHeatingCoolingState.OFF
        : this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
    }

    getAllowedTargetHeatingState(value: CharacteristicValue): CharacteristicValue {
      // Limit the available modes because COOL and HEAT is not supported
      return value === this.platform.Characteristic.TargetHeatingCoolingState.OFF
        ? this.platform.Characteristic.TargetHeatingCoolingState.OFF
        : this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
    }

    getHeatingModeFromTargetState(value: CharacteristicValue): number {
      return value === this.platform.Characteristic.TargetHeatingCoolingState.OFF
        ? 2
        : 0;
    }

    async getBoostSwitchOn(): Promise<CharacteristicValue> {
      this.log.debug(`getBoostSwitchOn: ${this.states.boostActive}`);
      return this.states.boostActive;
    }

    async setBoostSwitchOn(value: CharacteristicValue) {
      this.states.boostActive = value as boolean;
      this.log.debug(`setBoostSwitchOn: ${this.states.boostActive}`);

      this.mqttClient.publish('thermostat/boost/active/set', this.states.boostActive ? '1' : '0');
    }
}