// Unit conversion utility for HACCP app

export type MeasurementSystem = 'SI' | 'USCS' | 'Imperial';

export interface UnitConversion {
  value: number;
  unit: string;
  system: MeasurementSystem;
}

// Conversion factors for common units
const CONVERSION_FACTORS = {
  // Temperature
  temperature: {
    celsius: { fahrenheit: (c: number) => (c * 9/5) + 32, kelvin: (c: number) => c + 273.15 },
    fahrenheit: { celsius: (f: number) => (f - 32) * 5/9, kelvin: (f: number) => (f - 32) * 5/9 + 273.15 },
    kelvin: { celsius: (k: number) => k - 273.15, fahrenheit: (k: number) => (k - 273.15) * 9/5 + 32 }
  },
  
  // Weight/Mass
  weight: {
    kg: { lb: (kg: number) => kg * 2.20462, g: (kg: number) => kg * 1000 },
    lb: { kg: (lb: number) => lb / 2.20462, g: (lb: number) => lb * 453.592 },
    g: { kg: (g: number) => g / 1000, lb: (g: number) => g / 453.592 }
  },
  
  // Volume
  volume: {
    l: { gal: (l: number) => l * 0.264172, ml: (l: number) => l * 1000 },
    gal: { l: (gal: number) => gal / 0.264172, ml: (gal: number) => gal * 3785.41 },
    ml: { l: (ml: number) => ml / 1000, gal: (ml: number) => ml / 3785.41 }
  },
  
  // Length
  length: {
    m: { ft: (m: number) => m * 3.28084, cm: (m: number) => m * 100 },
    ft: { m: (ft: number) => ft / 3.28084, cm: (ft: number) => ft * 30.48 },
    cm: { m: (cm: number) => cm / 100, ft: (cm: number) => cm / 30.48 }
  }
};

// Default units for each system
const SYSTEM_UNITS = {
  SI: {
    temperature: '°C',
    weight: 'kg',
    volume: 'L',
    length: 'm'
  },
  USCS: {
    temperature: '°F',
    weight: 'lb',
    volume: 'gal',
    length: 'ft'
  },
  Imperial: {
    temperature: '°F',
    weight: 'lb',
    volume: 'gal',
    length: 'ft'
  }
};

export class UnitConverter {
  private companyUnits: string;
  private system: MeasurementSystem;

  constructor(companyUnits: string) {
    this.companyUnits = companyUnits;
    this.system = this.detectSystem(companyUnits);
  }

  private detectSystem(units: string): MeasurementSystem {
    const lowerUnits = units.toLowerCase();
    
    if (lowerUnits.includes('metric') || lowerUnits.includes('si') || 
        lowerUnits.includes('celsius') || lowerUnits.includes('kg') || 
        lowerUnits.includes('liter') || lowerUnits.includes('meter')) {
      return 'SI';
    } else if (lowerUnits.includes('imperial') || lowerUnits.includes('uk')) {
      return 'Imperial';
    } else {
      return 'USCS'; // Default to US Customary
    }
  }

  // Convert temperature
  convertTemperature(value: number, fromUnit: string, toUnit?: string): UnitConversion {
    const targetUnit = toUnit || SYSTEM_UNITS[this.system].temperature;
    
    let convertedValue = value;
    
    // Convert to Celsius first if needed
    if (fromUnit.toLowerCase().includes('fahrenheit') || fromUnit.includes('°f')) {
      convertedValue = CONVERSION_FACTORS.temperature.fahrenheit.celsius(value);
    } else if (fromUnit.toLowerCase().includes('kelvin') || fromUnit.includes('k')) {
      convertedValue = CONVERSION_FACTORS.temperature.kelvin.celsius(value);
    }
    
    // Convert from Celsius to target unit
    if (targetUnit.toLowerCase().includes('fahrenheit') || targetUnit.includes('°f')) {
      convertedValue = CONVERSION_FACTORS.temperature.celsius.fahrenheit(convertedValue);
    } else if (targetUnit.toLowerCase().includes('kelvin') || targetUnit.includes('k')) {
      convertedValue = CONVERSION_FACTORS.temperature.celsius.kelvin(convertedValue);
    }
    
    return {
      value: Math.round(convertedValue * 100) / 100, // Round to 2 decimal places
      unit: targetUnit,
      system: this.system
    };
  }

  // Convert weight/mass
  convertWeight(value: number, fromUnit: string, toUnit?: string): UnitConversion {
    const targetUnit = toUnit || SYSTEM_UNITS[this.system].weight;
    
    let convertedValue = value;
    
    // Convert to kg first if needed
    if (fromUnit.toLowerCase().includes('pound') || fromUnit.includes('lb')) {
      convertedValue = CONVERSION_FACTORS.weight.lb.kg(value);
    } else if (fromUnit.toLowerCase().includes('gram') || fromUnit.includes('g')) {
      convertedValue = CONVERSION_FACTORS.weight.g.kg(value);
    }
    
    // Convert from kg to target unit
    if (targetUnit.toLowerCase().includes('pound') || targetUnit.includes('lb')) {
      convertedValue = CONVERSION_FACTORS.weight.kg.lb(convertedValue);
    } else if (targetUnit.toLowerCase().includes('gram') || targetUnit.includes('g')) {
      convertedValue = CONVERSION_FACTORS.weight.kg.g(convertedValue);
    }
    
    return {
      value: Math.round(convertedValue * 100) / 100,
      unit: targetUnit,
      system: this.system
    };
  }

  // Convert volume
  convertVolume(value: number, fromUnit: string, toUnit?: string): UnitConversion {
    const targetUnit = toUnit || SYSTEM_UNITS[this.system].volume;
    
    let convertedValue = value;
    
    // Convert to liters first if needed
    if (fromUnit.toLowerCase().includes('gallon') || fromUnit.includes('gal')) {
      convertedValue = CONVERSION_FACTORS.volume.gal.l(value);
    } else if (fromUnit.toLowerCase().includes('milliliter') || fromUnit.includes('ml')) {
      convertedValue = CONVERSION_FACTORS.volume.ml.l(value);
    }
    
    // Convert from liters to target unit
    if (targetUnit.toLowerCase().includes('gallon') || targetUnit.includes('gal')) {
      convertedValue = CONVERSION_FACTORS.volume.l.gal(convertedValue);
    } else if (targetUnit.toLowerCase().includes('milliliter') || targetUnit.includes('ml')) {
      convertedValue = CONVERSION_FACTORS.volume.l.ml(convertedValue);
    }
    
    return {
      value: Math.round(convertedValue * 100) / 100,
      unit: targetUnit,
      system: this.system
    };
  }

  // Format measurement for display
  formatMeasurement(value: number, unit: string): string {
    return `${value} ${unit}`;
  }

  // Get company's preferred units
  getCompanyUnits(): string {
    return this.companyUnits;
  }

  // Get measurement system
  getSystem(): MeasurementSystem {
    return this.system;
  }

  // Get preferred unit for a specific measurement type
  getPreferredUnit(type: 'temperature' | 'weight' | 'volume' | 'length'): string {
    return SYSTEM_UNITS[this.system][type];
  }
}

// Hook for using unit conversion throughout the app
export const useUnitConversion = (companyUnits: string) => {
  const converter = new UnitConverter(companyUnits);
  
  return {
    converter,
    convertTemperature: (value: number, fromUnit: string, toUnit?: string) => 
      converter.convertTemperature(value, fromUnit, toUnit),
    convertWeight: (value: number, fromUnit: string, toUnit?: string) => 
      converter.convertWeight(value, fromUnit, toUnit),
    convertVolume: (value: number, fromUnit: string, toUnit?: string) => 
      converter.convertVolume(value, fromUnit, toUnit),
    formatMeasurement: (value: number, unit: string) => 
      converter.formatMeasurement(value, unit),
    getCompanyUnits: () => converter.getCompanyUnits(),
    getSystem: () => converter.getSystem(),
    getPreferredUnit: (type: 'temperature' | 'weight' | 'volume' | 'length') => 
      converter.getPreferredUnit(type)
  };
};
