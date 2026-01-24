import type { NextConfig } from 'next'

const config: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('better-sqlite3')
    }
    return config
  },
}

export default config
