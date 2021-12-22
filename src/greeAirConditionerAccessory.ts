import { Service, PlatformAccessory, CharacteristicValue, PlatformConfig } from 'homebridge';
import { CategoryLogger } from './CategoryLogger';
import { SmartHomeIntegrationPlatform } from './platform';
import * as Device from '@internal/gree/device.js';
import { openStdin } from 'process';

export class GreeAirConditionerAccessory {
  private readonly log: CategoryLogger;
  private readonly service: Service;
  // private readonly turboSwitchService: Service;
  private readonly fanService: Service;
  // private readonly slatsService: Service;
  private readonly device: Device.Device;

  private states = {
    rotationSpeed: 0,
    slatsTiltAngle: 0,
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

    this.log.info('created');

    // The base service
    this.service = this.accessory.getServiceById(this.platform.Service.HeaterCooler, this.accessory.displayName)
      || this.accessory.addService(this.platform.Service.HeaterCooler, this.accessory.displayName, this.accessory.displayName);

    // Fan service
    const fanServiceName = `${this.accessory.context.device.uniqueId}-Fan`;
    this.fanService = this.accessory.getServiceById(this.platform.Service.Fan, fanServiceName)
      || this.accessory.addService(this.platform.Service.Fan, 'Fan', fanServiceName);
    this.setupFanService();

    this.device = new Device.Device(this.address);

    // this.setupDevice();
    // this.setupBaseCharacteristics();

    // this.setupRotationSpeedControl();

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


    // TURBO switch

    // const switchName = `${this.name}-TurboSwitch`;

    // this.turboSwitchService = this.accessory.getServiceById(this.platform.Service.Switch, switchName)
    //   || this.accessory.addService(this.platform.Service.Switch, switchName, switchName);

    // this.turboSwitchService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    // this.turboSwitchService.setCharacteristic(this.platform.Characteristic.Name, 'Turbo');

    // this.turboSwitchService.setCharacteristic(this.platform.Characteristic.On, true);

    // FAN service







    // SLATS service

    // const slatsServiceName = `${this.name}-Slats`;

    // this.slatsService = this.accessory.getServiceById(platform.Service.Slats, slatsServiceName)
    //   || this.accessory.addService(platform.Service.Slats, slatsServiceName, slatsServiceName);

    // this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    // this.slatsService.setCharacteristic(this.platform.Characteristic.Name, 'AC Internal Slat');

    // this.slatsService.getCharacteristic(this.platform.Characteristic.CurrentSlatState)
    //   .onGet(async () => {
    //     this.log.info('get: CurrentSlatState');
    //     return this.platform.Characteristic.CurrentSlatState.SWINGING;
    //   });

    // this.slatsService.getCharacteristic(this.platform.Characteristic.SlatType)
    //   .onGet(async () => {
    //     this.log.info('get: SlatType');
    //     return this.platform.Characteristic.SlatType.VERTICAL;
    //   });

    // this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.CurrentTiltAngle);
    // this.slatsService.getCharacteristic(this.platform.Characteristic.CurrentTiltAngle)
    //   .onGet(async () => {
    //     this.log.info('get: CurrentTiltAngle');
    //     return 0;
    //   });

    // this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.TargetTiltAngle);
    // this.slatsService.getCharacteristic(this.platform.Characteristic.TargetTiltAngle)
    //   .onGet(async () => {
    //     this.log.info('get: TargetTiltAngle');
    //     return this.states.slatsTiltAngle;
    //   })
    //   .onSet(async (value: CharacteristicValue) => {
    //     this.states.slatsTiltAngle = value as number;
    //     this.log.info(`set: TargetTiltAngle, value=${this.states.slatsTiltAngle}`);
    //   });

    // this.service.addLinkedService(this.slatsService);

    // this.slatsService.setCharacteristic(
    //   this.platform.Characteristic.CurrentSlatState,
    //   this.platform.Characteristic.CurrentSlatState.SWINGING
    // );

    // this.slatsService.setCharacteristic(this.platform.Characteristic.SlatType, this.platform.Characteristic.SlatType.VERTICAL);

    // this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    // this.slatsService.setCharacteristic(this.platform.Characteristic.Name, 'Slats');

    // this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.SwingMode);
    // this.slatsService.setCharacteristic(this.platform.Characteristic.SwingMode, this.platform.Characteristic.SwingMode.SWING_ENABLED);

    // this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.CurrentTiltAngle);
    // this.slatsService.setCharacteristic(this.platform.Characteristic.CurrentTiltAngle, 45);

    // this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.TargetTiltAngle);
    // this.slatsService.setCharacteristic(this.platform.Characteristic.TargetTiltAngle, 45);

    // this.device = new Device.Device('192.168.30.4');
    // this.device.on('params', (params) => {
    //   this.log.info(`params=${JSON.stringify(params)}`);
    // });
  }

  // setupRotationSpeedControl() {
  //   this.service.addOptionalCharacteristic(this.platform.Characteristic.RotationSpeed);

  //   this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
  //     .onGet(async () => {
  //       this.log.info('get: RotationSpeed');
  //       return this.states.rotationSpeed;
  //     })
  //     .onSet(async (value: CharacteristicValue) => {
  //       this.states.rotationSpeed = value as number;
  //       this.log.info(`set: RotationSpeed, value=${this.states.rotationSpeed}`);
  //     });
  // }

  setupDevice() {
    this.log.info('setting up the device');

    this.device.on('params', this.updateCharacteristicsFromDeviceParams.bind(this));
  }

  setupBaseCharacteristics() {
    this.log.info('setting up base characteristics');

    this.service.setCharacteristic(this.platform.Characteristic.CurrentTemperature, 0);

    // TargetTemperature
    this.service.setCharacteristic(this.platform.Characteristic.TargetTemperature, 0);
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onSet(async (value: CharacteristicValue) => {
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
        this.device.set_param(Device.DeviceParameters.POWER_ON, value as boolean);
      });
  }

  setupFanService() {
    // this.service.addLinkedService(this.fanService);

    this.fanService.setCharacteristic(this.platform.Characteristic.Active, false);

    // this.fanService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    // this.fanService.setCharacteristic(this.platform.Characteristic.Name, 'AC Internal Fan');

    this.fanService.addOptionalCharacteristic(this.platform.Characteristic.CurrentFanState);
    this.fanService.setCharacteristic(
      this.platform.Characteristic.CurrentFanState,
      this.platform.Characteristic.CurrentFanState.INACTIVE,
    );

    this.fanService.addOptionalCharacteristic(this.platform.Characteristic.RotationSpeed);
    this.fanService.setCharacteristic(this.platform.Characteristic.RotationSpeed, 0);
  }

  updateCharacteristicsFromDeviceParams() {
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
    this.fanService.updateCharacteristic(
      this.platform.Characteristic.CurrentFanState,
      powerOn
        ? this.platform.Characteristic.CurrentFanState.BLOWING_AIR
        : this.platform.Characteristic.CurrentFanState.INACTIVE,
    );
    this.fanService.updateCharacteristic(
      this.platform.Characteristic.Active,
      powerOn,
    );

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

    const turboOn = params[Device.DeviceParameters.TURBO_ON.name] === true;
    const fanSpeed = params[Device.DeviceParameters.FAN_SPEED.name];
    if (fanSpeed) {
      let rotationSpeed = 0;

      if (fanSpeed === 0) {
        // TODO turn on 'auto fan' switch
      } else if (turboOn) {
        rotationSpeed = 100;
      } else if (fanSpeed >= 5) {
        rotationSpeed = 75;
      } else if (fanSpeed >= 3) {
        rotationSpeed = 50;
      } else {
        rotationSpeed = 25;
      }

      this.log.info(`calculated RotationSpeed: ${rotationSpeed}`);

      this.fanService.updateCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        rotationSpeed,
      );
    }
  }
}