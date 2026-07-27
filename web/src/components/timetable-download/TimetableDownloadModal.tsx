export type TimetableDownloadMode = 'custom' | 'device';

export type DeviceManufacturer = 'apple' | 'samsung';

export type MobileDeviceCategory = 'smartphone' | 'tablet';

export interface PixelDimensions {
  width: number;
  height: number;
}

export interface CustomSizeValues {
  width: string;
  height: string;
}

export interface MobileDevicePreset {
  id: string;
  manufacturer: DeviceManufacturer;
  category: MobileDeviceCategory;
  modelName: string;
  dimensions: PixelDimensions;
}

export type DimensionValidationResult =
  | {
      isValid: true;
      dimensions: PixelDimensions;
    }
  | {
      isValid: false;
      errorMessage: string;
    };