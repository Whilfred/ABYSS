export const lightColors = {
  primary: '#1E5BFF', 
  primaryDark: '#1647CC', 
  bg: '#FFFFFF', 
  surface: '#F3F6FF',
  text: '#0B1B3F', 
  muted: '#6B7A99', 
  border: '#E3E8F5', 
  danger: '#E5484D', 
  success: '#12B76A',
  bubbleOther: '#EEF2FF',
};

export const darkColors = {
  primary: '#3B82F6', 
  primaryDark: '#2563EB', 
  bg: '#0F172A',       // Fond général très foncé
  surface: '#1E293B',  // Fond des cartes/inputs
  text: '#F8FAFC',     // Texte blanc cassé
  muted: '#94A3B8',    // Texte secondaire
  border: '#334155',   // Bordures sombres
  danger: '#EF4444', 
  success: '#10B981',
  bubbleOther: '#334155', // Bulles reçues
};

// On garde "colors" pour les anciens fichiers qui ne connaissent pas encore le thème
export const colors = lightColors; 
