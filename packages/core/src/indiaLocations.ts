import { INDIA_CITY_DATASET } from './indiaCityDataset';

export const INDIA_COUNTRY_OPTION = {
  code: 'IN',
  name: 'India',
  currency: 'INR',
} as const;

export const INDIA_STATE_OPTIONS = [
  { code: 'AP', name: 'Andhra Pradesh', cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati'] },
  { code: 'AR', name: 'Arunachal Pradesh', cities: ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang'] },
  { code: 'AS', name: 'Assam', cities: ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat'] },
  { code: 'BR', name: 'Bihar', cities: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur'] },
  { code: 'CG', name: 'Chhattisgarh', cities: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba'] },
  { code: 'GA', name: 'Goa', cities: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'] },
  { code: 'GJ', name: 'Gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Gandhinagar'] },
  { code: 'HR', name: 'Haryana', cities: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala'] },
  { code: 'HP', name: 'Himachal Pradesh', cities: ['Shimla', 'Dharamshala', 'Mandi', 'Solan'] },
  { code: 'JH', name: 'Jharkhand', cities: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'] },
  { code: 'KA', name: 'Karnataka', cities: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi'] },
  { code: 'KL', name: 'Kerala', cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur'] },
  { code: 'MP', name: 'Madhya Pradesh', cities: ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior'] },
  { code: 'MH', name: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane'] },
  { code: 'MN', name: 'Manipur', cities: ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur'] },
  { code: 'ML', name: 'Meghalaya', cities: ['Shillong', 'Tura', 'Jowai', 'Nongpoh'] },
  { code: 'MZ', name: 'Mizoram', cities: ['Aizawl', 'Lunglei', 'Champhai', 'Kolasib'] },
  { code: 'NL', name: 'Nagaland', cities: ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang'] },
  { code: 'OD', name: 'Odisha', cities: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri'] },
  { code: 'PB', name: 'Punjab', cities: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'] },
  { code: 'RJ', name: 'Rajasthan', cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'] },
  { code: 'SK', name: 'Sikkim', cities: ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan'] },
  { code: 'TN', name: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'] },
  { code: 'TS', name: 'Telangana', cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'] },
  { code: 'TR', name: 'Tripura', cities: ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar'] },
  { code: 'UP', name: 'Uttar Pradesh', cities: ['Lucknow', 'Kanpur', 'Noida', 'Varanasi', 'Agra'] },
  { code: 'UK', name: 'Uttarakhand', cities: ['Dehradun', 'Haridwar', 'Haldwani', 'Roorkee'] },
  { code: 'WB', name: 'West Bengal', cities: ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri'] },
  { code: 'AN', name: 'Andaman and Nicobar Islands', cities: ['Port Blair', 'Mayabunder', 'Diglipur'] },
  { code: 'CH', name: 'Chandigarh', cities: ['Chandigarh'] },
  { code: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu', cities: ['Daman', 'Diu', 'Silvassa'] },
  { code: 'DL', name: 'Delhi', cities: ['New Delhi', 'Delhi'] },
  { code: 'JK', name: 'Jammu and Kashmir', cities: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'] },
  { code: 'LA', name: 'Ladakh', cities: ['Leh', 'Kargil'] },
  { code: 'LD', name: 'Lakshadweep', cities: ['Kavaratti', 'Agatti', 'Minicoy'] },
  { code: 'PY', name: 'Puducherry', cities: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'] },
] as const;

export function getIndiaStateName(stateCode: string) {
  return INDIA_STATE_OPTIONS.find((state) => state.code === stateCode.toUpperCase())?.name ?? stateCode;
}

export function getIndiaCityOptions(stateCode: string): string[] {
  const normalizedStateCode = stateCode.toUpperCase();
  const baseCities = INDIA_STATE_OPTIONS.find((state) => state.code === normalizedStateCode)?.cities ?? [];
  const expandedCities = INDIA_CITY_DATASET[normalizedStateCode] ?? [];
  return Array.from(new Set([...expandedCities, ...baseCities])).sort((left, right) =>
    left.localeCompare(right)
  );
}

export function getDefaultIndiaCity(stateCode: string): string {
  return getIndiaCityOptions(stateCode)[0] ?? '';
}
