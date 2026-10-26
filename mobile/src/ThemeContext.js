import React, { createContext, useContext, useState } from 'react';
import { lightColors, darkColors } from './theme';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false); 
  
  // On choisit le thème en fonction de l'état
  const colors = isDark ? darkColors : lightColors;
  
  // Fonction pour basculer
  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Petit raccourci pour utiliser le thème facilement
export const useTheme = () => useContext(ThemeContext);
