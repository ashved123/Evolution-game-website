import React, { createContext, useContext } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  return (
    <AuthContext.Provider value={{
      user:     { username: 'player' },
      loading:  false,
      login:    async () => {},
      register: async () => {},
      logout:   async () => {},
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
