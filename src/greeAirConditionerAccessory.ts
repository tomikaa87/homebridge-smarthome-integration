import { Service, PlatformAccessory, CharacteristicValue, CharacteristicGetHandler, CharacteristicSetHandler } from 'homebridge';
import { CategoryLogger } from './CategoryLogger';
import { SmartHomeIntegrationPlatform } from './platform';
import * as Device from './gree/device.js';

export class GreeAirConditionerAccessory {
  private readonly log: CategoryLogger;
  private readonly service: Service;
  private readonly turboSwitchService: Service;
  private readonly xfanSwitchService: Service;
  private readonly ledSwitchService: Service;
  private readonly manualFanService: Service;
  private readonly slatsService: Service;
  private readonly device: Device.Device;

  private states = {
    manualFanSpeed: 0,
    verticalSlatPosition: 0,
    skipNextUpdate: false,
    // verticalSlatTargetPosition: 0,
  };

  private temps = {
    heatingThreshold: 0,
    coolingThreshold: 0,
  };

  constructor(
        private readonly platform: SmartHomeIntegrationPlatform,
        private readonly accessory: PlatformAccessory,
        private readonly address: string,
  ) {
    this.log = new CategoryLogger(
      this.platform.log,
      `${this.accessory.context.device.uniqueId}(${this.accessory.context.device.displayName})`,
    );

    this.log.info(`created: displayName=${this.accessory.displayName}`);

    // The base service
    this.service = this.accessory.getServiceById(this.platform.Service.HeaterCooler, this.accessory.displayName)
      || this.accessory.addService(this.platform.Service.HeaterCooler, this.accessory.displayName, this.accessory.displayName);

    // Fan service
    const fanServiceName = `${this.accessory.context.device.uniqueId}-Fan`;
    this.manualFanService = this.accessory.getServiceById(this.platform.Service.Fan, fanServiceName)
      || this.accessory.addService(this.platform.Service.Fan, 'Fan', fanServiceName);
    this.setupFanService();

    // Slats service
    const slatsServiceName = `${this.accessory.context.device.uniqueId}-Slats`;
    this.slatsService = this.accessory.getServiceById(this.platform.Service.WindowCovering, slatsServiceName)
      || this.accessory.addService(this.platform.Service.WindowCovering, slatsServiceName, slatsServiceName);
    this.setupVerticalSlat();

    this.device = new Device.Device(this.address);

    this.setupDevice();
    this.setupBaseCharacteristics();

    // TEST
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(async (value: CharacteristicValue) => {
        this.log.info(`*** Active=${value as boolean}`);
      });
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onSet(async (value: CharacteristicValue) => {
        this.log.info(`*** TargetHeaterCoolerState=${value as number}`);
      });
    this.service.addOptionalCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature);
    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .onSet(async (value: CharacteristicValue) => {
        this.log.info(`*** CoolingThresholdTemperature=${value}`);

        this.temps.coolingThreshold = value as number;

        if (Math.abs(this.temps.heatingThreshold - this.temps.coolingThreshold) < 4) {
          const heatingThreshold = this.temps.coolingThreshold - 4;
          this.service.setCharacteristic(
            this.platform.Characteristic.HeatingThresholdTemperature,
            heatingThreshold,
          );
          this.service.updateCharacteristic(
            this.platform.Characteristic.HeatingThresholdTemperature,
            heatingThreshold,
          );
        }
      });
    this.service.addOptionalCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature);
    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onSet(async (value: CharacteristicValue) => {
        this.log.info(`*** HeatingThresholdTemperature=${value}`);

        this.temps.heatingThreshold = value as number;

        if (Math.abs(this.temps.heatingThreshold - this.temps.coolingThreshold) < 4) {
          const coolingThreshold = this.temps.heatingThreshold + 4;
          this.service.setCharacteristic(
            this.platform.Characteristic.CoolingThresholdTemperature,
            coolingThreshold,
          );
          this.service.updateCharacteristic(
            this.platform.Characteristic.CoolingThresholdTemperature,
            coolingThreshold,
          );
        }
      });

    this.turboSwitchService = this.createSimpleFunctionSwitchService(
      'TurboSwitch',
      'Turbo',
      async () => {
        return this.device.get_params()[Device.DeviceParameters.TURBO_ON.name] === true
          ? 1
          : 0;
      },
      async (value: CharacteristicValue) => {
        this.log.info(`*** Turbo: ${value as number}`);
        this.device.set_param(Device.DeviceParameters.TURBO_ON, value ? 1 : 0);
      },
    );

    this.xfanSwitchService = this.createSimpleFunctionSwitchService(
      'XfanSwitch',
      'X-Fan',
      async () => {
        return this.device.get_params()[Device.DeviceParameters.XFAN_ON.name] === true
          ? 1
          : 0;
      },
      async (value: CharacteristicValue) => {
        this.log.info(`*** X-Fan: ${value as number}`);
        this.device.set_param(Device.DeviceParameters.XFAN_ON, value ? 1 : 0);
      },
    );

    this.ledSwitchService = this.createSimpleFunctionSwitchService(
      'LedSwitch',
      'LED',
      async () => {
        return this.device.get_params()[Device.DeviceParameters.LED_ON.name] === true
          ? 1
          : 0;
      },
      async (value: CharacteristicValue) => {
        this.log.info(`*** LED: ${value as number}`);
        this.device.set_param(Device.DeviceParameters.LED_ON, value ? 1 : 0);
      },
    );

  }

  setupDevice() {
    this.log.info('setting up the device');

    this.device.on('params', this.updateCharacteristicsFromDeviceParams.bind(this));
  }

  setupBaseCharacteristics() {
    this.log.info('setting up base characteristics');

    this.service.setCharacteristic(this.platform.Characteristic.CurrentTemperature, 25);

    // TargetTemperature
    this.service.setCharacteristic(this.platform.Characteristic.TargetTemperature, 25);
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onSet(async (value: CharacteristicValue) => {
        this.log.info(`*** Set target temperature of device: ${value as number}`);
        this.device.set_param(Device.DeviceParameters.TARGET_TEMP, value as number);
      });

    // CurrentHeaterCoolerState
    this.service.setCharacteristic(
      this.platform.Characteristic.CurrentHeaterCoolerState,
      this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE,
    );

    // TargetHeaterCoolerState
    this.service.setCharacteristic(
      this.platform.Characteristic.TargetHeaterCoolerState,
      this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
    );

    this.service.addOptionalCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature);
    this.service.addOptionalCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature);
    this.service.setCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, 24);
    this.service.setCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, 24);

    this.service.setCharacteristic(this.platform.Characteristic.Active, false);
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(async (value: CharacteristicValue) => {
        this.log.info(`*** Set power state of device: ${value as number}`);
        this.device.set_param(Device.DeviceParameters.POWER_ON, value as boolean);
      });
  }

  setupFanService() {
    this.manualFanService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    this.manualFanService.setCharacteristic(this.platform.Characteristic.Name, `${this.accessory.displayName} Manual Fan`);

    this.manualFanService.addOptionalCharacteristic(this.platform.Characteristic.RotationSpeed);

    this.manualFanService.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onSet(async (value: CharacteristicValue) => {
        const speed = Math.round(value as number / 20);

        this.log.info(`Set manual fan RotationSpeed: value=${value as number}, speed=${speed}`);

        this.device.set_param(Device.DeviceParameters.FAN_SPEED, speed);

        if (speed === 0) {
          this.log.info('Deactivating manual fan, RotationSpeed == 0');

          this.manualFanService.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.platform.Characteristic.Active.INACTIVE,
          );
        }

        // Workaround to avoid overwriting the new value with the old one
        this.states.skipNextUpdate = true;
      });

    this.manualFanService.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(async (value: CharacteristicValue) => {
        this.log.info(`Set manual fan Active state: ${value as number}`);

        if (value as boolean) {
          this.log.info(`Restoring previous manual fan speed: ${this.states.manualFanSpeed}`);

          this.device.set_param(Device.DeviceParameters.FAN_SPEED, this.states.manualFanSpeed);
        } else {
          this.log.info('Deactivating manual fan, Active == false');

          this.device.set_param(Device.DeviceParameters.FAN_SPEED, 0);
        }

        // Workaround to avoid overwriting the new value with the old one
        this.states.skipNextUpdate = true;
      });
  }

  setupVerticalSlat(): void {
    this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    this.slatsService.setCharacteristic(this.platform.Characteristic.Name, `${this.accessory.displayName} Vertical Slat`);

    this.slatsService.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onGet(async () => {
        return this.states.verticalSlatPosition;
      })
      .onSet(async (value: CharacteristicValue) => {
        this.states.verticalSlatPosition = Math.round(value as number / 25) * 25;
        const mapped = 4 - Math.round(this.states.verticalSlatPosition / 25) + 2;

        this.log.info(`*** Slats set target position: ${this.states.verticalSlatPosition}, mapped=${mapped}`);

        this.device.set_param(Device.DeviceParameters.V_SWING, mapped);

        this.slatsService.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.states.verticalSlatPosition);
      });

    this.slatsService.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(async () => {
        this.log.info(`Current vertical slat position: ${this.states.verticalSlatPosition}`);
        return this.states.verticalSlatPosition;
      });
  }

  updateCharacteristicsFromDeviceParams() {
    if (this.states.skipNextUpdate) {
      this.states.skipNextUpdate = false;
      return;
    }

    const params = this.device.get_params();

    if (params === undefined) {
      this.log.warn('cannot read params');
      return;
    }

    this.log.debug(`device parameters updated: params=${JSON.stringify(params)}`);

    const powerOn = params[Device.DeviceParameters.POWER_ON.name] === true;
    this.service.updateCharacteristic(
      this.platform.Characteristic.Active,
      powerOn,
    );

    const xfanEnabled = params[Device.DeviceParameters.XFAN_ON.name] === true;
    this.log.info(`xfanEnabled=${xfanEnabled}`);
    this.xfanSwitchService.updateCharacteristic(
      this.platform.Characteristic.On,
      xfanEnabled ? 1 : 0,
    );

    const turboEnabled = params[Device.DeviceParameters.TURBO_ON.name] === true;
    this.log.info(`turboEnabled=${turboEnabled}`);
    this.turboSwitchService.updateCharacteristic(
      this.platform.Characteristic.On,
      turboEnabled ? 1 : 0,
    );

    const ledEnabled = params[Device.DeviceParameters.LED_ON.name] === true;
    this.log.info(`ledEnabled=${ledEnabled}`);
    this.ledSwitchService.updateCharacteristic(
      this.platform.Characteristic.On,
      ledEnabled ? 1 : 0,
    );

    const fanSpeed = params[Device.DeviceParameters.FAN_SPEED.name] as number;
    this.log.info(`fanSpeed=${fanSpeed}`);

    if (fanSpeed > 0) {
      this.states.manualFanSpeed = fanSpeed;
      this.log.info(`Manual fan speed updated to ${this.states.manualFanSpeed}`);
    }

    this.manualFanService.updateCharacteristic(
      this.platform.Characteristic.Active,
      fanSpeed !== 0
        ? this.platform.Characteristic.Active.ACTIVE
        : this.platform.Characteristic.Active.INACTIVE,
    );

    this.manualFanService.updateCharacteristic(
      this.platform.Characteristic.RotationSpeed,
      fanSpeed * 20,
    );

    // this.manualFanService.updateCharacteristic(
    //   this.platform.Characteristic.TargetFanState,
    //   fanSpeed === 0
    //     ? this.platform.Characteristic.TargetFanState.AUTO
    //     : this.platform.Characteristic.TargetFanState.MANUAL,
    // );
    // this.manualFanService.updateCharacteristic(
    //   this.platform.Characteristic.CurrentFanState,
    //   this.platform.Characteristic.CurrentFanState.BLOWING_AIR,
    // );

    const sensorTemp = params[Device.DeviceParameters.SENSOR_TEMP.name];
    if (sensorTemp) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        sensorTemp,
      );
    }

    const targetTemp = params[Device.DeviceParameters.TARGET_TEMP.name];
    if (targetTemp) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetTemperature,
        targetTemp,
      );
    }

    const verticalSlastPosition = params[Device.DeviceParameters.V_SWING.name];
    if (verticalSlastPosition) {
      const p = verticalSlastPosition as number;

      switch (p) {
        case 0: // Default
        case 1: // Swing: full-range
        case 7: // Swing: 5/5
        case 8: // Swing: 4/5
        case 9: // Swing: 3/5
        case 10: // Swing: 2/5
        case 11: // Swing: 1/5
          // Unsupported at the moment
          this.states.verticalSlatPosition = 0;
          break;
        case 2: // Fixed: 1/5
        case 3: // Fixed: 2/5
        case 4: // Fixed: 3/5
        case 5: // Fixed: 4/5
        case 6: // Fixed: 5/5
          this.states.verticalSlatPosition = (4 - (p - 2)) * 25; // Map [6..2] -> [0..100]
          break;
      }

      this.log.info(`verticalSlatPosition=${verticalSlastPosition as number}, calculated=${this.states.verticalSlatPosition}`);

      this.slatsService.setCharacteristic(
        this.platform.Characteristic.CurrentPosition,
        this.states.verticalSlatPosition,
      );

      this.slatsService.updateCharacteristic(
        this.platform.Characteristic.TargetPosition,
        this.states.verticalSlatPosition,
      );

      this.slatsService.setCharacteristic(
        this.platform.Characteristic.PositionState,
        this.platform.Characteristic.PositionState.STOPPED,
      );
    }

    const mode = params[Device.DeviceParameters.MODE.name];
    if (mode) {
      const currentState = ((): CharacteristicValue => {
        if (!powerOn) {
          return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
        }

        switch (mode) {
          case Device.DeviceParameters.MODE.modes.AUTO:
            if (sensorTemp > 24 && sensorTemp < 26) {
              return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
            } else if (sensorTemp >= 26) {
              return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
            } else if (sensorTemp <= 24) {
              return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
            }
            break;

          case Device.DeviceParameters.MODE.modes.COOL:
            return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;

          case Device.DeviceParameters.MODE.modes.HEAT:
            return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;

          case Device.DeviceParameters.MODE.modes.DRY:
            if (sensorTemp > 25) {
              return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
            } else {
              return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
            }

          case Device.DeviceParameters.MODE.modes.FAN:
            return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }

        return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
      })();
      this.log.info(`calculated CurrentHeaterCoolerState: ${currentState}`);

      const targetState = ((): CharacteristicValue => {
        switch (mode) {
          case Device.DeviceParameters.MODE.modes.AUTO:
          case Device.DeviceParameters.MODE.modes.DRY:
          case Device.DeviceParameters.MODE.modes.FAN:
            return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;

          case Device.DeviceParameters.MODE.modes.COOL:
            return this.platform.Characteristic.TargetHeaterCoolerState.COOL;

          case Device.DeviceParameters.MODE.modes.HEAT:
            return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
        }

        return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
      })();
      this.log.info(`calculated TargetHeaterCoolerState: ${targetState}`);

      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetHeaterCoolerState,
        targetState,
      );
    }
  }

  createSimpleFunctionSwitchService(
    id: string,
    displayName: string,
    onGetFunc: CharacteristicGetHandler,
    onSetFunc: CharacteristicSetHandler,
  ): Service {
    const uniqueId = `${this.accessory.context.device.uniqueId}-${id}`;

    this.log.info(`createSimpleFunctionSwitchService: uniqueId=${uniqueId}`);

    const service = this.accessory.getServiceById(this.platform.Service.Switch, uniqueId)
      || this.accessory.addService(this.platform.Service.Switch, uniqueId, uniqueId);

    service.addOptionalCharacteristic(this.platform.Characteristic.Name);
    service.setCharacteristic(this.platform.Characteristic.Name, `${this.accessory.displayName} ${displayName}`);

    service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(onGetFunc)
      .onSet(onSetFunc);

    return service;
  }
}