export const COUNTRIES = [
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯', dial: '+229', providers: ['MTN MoMo', 'Moov Money', 'Celtiis Cash'] },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', dial: '+228', providers: ['T-Money', 'Flooz'] },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮', dial: '+225', providers: ['Orange Money', 'MTN MoMo', 'Moov Money', 'Wave'] },
  { code: 'NE', name: 'Niger', flag: '🇳🇪', dial: '+227', providers: ['Airtel Money', 'Moov Money', 'Orange Money'] },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', dial: '+226', providers: ['Orange Money', 'Moov Money'] },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳', dial: '+221', providers: ['Wave', 'Orange Money', 'Free Money'] },
];
export const byCode = (c) => COUNTRIES.find((x) => x.code === c) || COUNTRIES[0];
