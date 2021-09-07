import { Service, PlatformAccessory, CharacteristicValue, PlatformConfig } from 'homebridge';
import { CategoryLogger } from './CategoryLogger';
import { SmartHomeIntegrationPlatform } from './platform';

export class GreeAirConditionerAccessory {
  private readonly log: CategoryLogger;
  private readonly service: Service;
  // private readonly turboSwitchService: Service;
  private readonly fanService: Service;
  private readonly slatsService: Service;

  private states = {
    rotationSpeed: 0,
    slatsTiltAngle: 0,
  };

  constructor(
        private readonly platform: SmartHomeIntegrationPlatform,
        private readonly accessory: PlatformAccessory,
        private readonly config: PlatformConfig,
        private readonly name: string,
  ) {
    this.log = new CategoryLogger(this.platform.log, `GreeAirConditioner(${this.name})`);

    this.service = this.accessory.getServiceById(this.platform.Service.HeaterCooler, name)
      || this.accessory.addService(this.platform.Service.HeaterCooler, this.name, this.name);

    // this.setupRotationSpeedControl();

    this.service.setCharacteristic(this.platform.Characteristic.CurrentTemperature, 24);

    this.service.setCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, 2);
    this.service.setCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, 2);

    this.service.addOptionalCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature);
    this.service.addOptionalCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature);
    this.service.setCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, 24);
    this.service.setCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, 24);

    this.service.setCharacteristic(this.platform.Characteristic.Active, false);

    // TURBO switch

    // const switchName = `${this.name}-TurboSwitch`;

    // this.turboSwitchService = this.accessory.getServiceById(this.platform.Service.Switch, switchName)
    //   || this.accessory.addService(this.platform.Service.Switch, switchName, switchName);

    // this.turboSwitchService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    // this.turboSwitchService.setCharacteristic(this.platform.Characteristic.Name, 'Turbo');

    // this.turboSwitchService.setCharacteristic(this.platform.Characteristic.On, true);

    // FAN service

    const fanServiceName = `${this.name}-Fan`;

    this.fanService = this.accessory.getServiceById(this.platform.Service.Fan, fanServiceName)
      || this.accessory.addService(this.platform.Service.Fan, 'Fan', fanServiceName);

    // this.service.addLinkedService(this.fanService);

    this.fanService.setCharacteristic(this.platform.Characteristic.Active, false);

    this.fanService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    this.fanService.setCharacteristic(this.platform.Characteristic.Name, 'AC Internal Fan');

    this.fanService.addOptionalCharacteristic(this.platform.Characteristic.CurrentFanState);
    this.fanService.setCharacteristic(this.platform.Characteristic.CurrentFanState, this.platform.Characteristic.CurrentFanState.BLOWING_AIR);

    this.fanService.addOptionalCharacteristic(this.platform.Characteristic.RotationSpeed);
    this.fanService.setCharacteristic(this.platform.Characteristic.RotationSpeed, 50);

    // SLATS service

    const slatsServiceName = `${this.name}-Slats`;

    this.slatsService = this.accessory.getServiceById(platform.Service.Slats, slatsServiceName)
      || this.accessory.addService(platform.Service.Slats, slatsServiceName, slatsServiceName);

    this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    this.slatsService.setCharacteristic(this.platform.Characteristic.Name, 'AC Internal Slat');

    this.slatsService.getCharacteristic(this.platform.Characteristic.CurrentSlatState)
      .onGet(async () => {
        this.log.info('get: CurrentSlatState');
        return this.platform.Characteristic.CurrentSlatState.JAMMED;
      });

    this.slatsService.getCharacteristic(this.platform.Characteristic.SlatType)
      .onGet(async () => {
        this.log.info('get: SlatType');
        return this.platform.Characteristic.SlatType.VERTICAL;
      });

    this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.CurrentTiltAngle);
    this.slatsService.getCharacteristic(this.platform.Characteristic.CurrentTiltAngle)
      .onGet(async () => {
        this.log.info('get: CurrentTiltAngle');
        return 0;
      });

    this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.TargetTiltAngle);
    this.slatsService.getCharacteristic(this.platform.Characteristic.TargetTiltAngle)
      .onGet(async () => {
        this.log.info('get: TargetTiltAngle');
        return this.states.slatsTiltAngle;
      })
      .onSet(async (value: CharacteristicValue) => {
        this.states.slatsTiltAngle = value as number;
        this.log.info(`set: TargetTiltAngle, value=${this.states.slatsTiltAngle}`);
      });

    // this.service.addLinkedService(this.slatsService);

    // this.slatsService.setCharacteristic(this.platform.Characteristic.CurrentSlatState, this.platform.Characteristic.CurrentSlatState.SWINGING);

    // this.slatsService.setCharacteristic(this.platform.Characteristic.SlatType, this.platform.Characteristic.SlatType.VERTICAL);

    // this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.Name);
    // this.slatsService.setCharacteristic(this.platform.Characteristic.Name, 'Slats');

    // this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.SwingMode);
    // this.slatsService.setCharacteristic(this.platform.Characteristic.SwingMode, this.platform.Characteristic.SwingMode.SWING_ENABLED);

    // this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.CurrentTiltAngle);
    // this.slatsService.setCharacteristic(this.platform.Characteristic.CurrentTiltAngle, 45);

    // this.slatsService.addOptionalCharacteristic(this.platform.Characteristic.TargetTiltAngle);
    // this.slatsService.setCharacteristic(this.platform.Characteristic.TargetTiltAngle, 45);

  }

  setupRotationSpeedControl() {
    this.service.addOptionalCharacteristic(this.platform.Characteristic.RotationSpeed);

    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(async () => {
        this.log.info('get: RotationSpeed');
        return this.states.rotationSpeed;
      })
      .onSet(async (value: CharacteristicValue) => {
        this.states.rotationSpeed = value as number;
        this.log.info(`set: RotationSpeed, value=${this.states.rotationSpeed}`);
      });
  }
}