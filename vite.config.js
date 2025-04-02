export default {
    root: '.',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            output: {
                manualChunks: {
                    three: ['three']
                }
            }
        }
    },
    server: {
        port: 3000,
        open: true
    },
    resolve: {
        alias: {
            '@': '/src',
            'three': 'three'
        },
        dedupe: ['three']
    },
    optimizeDeps: {
        include: [
            'three',
            'three/examples/jsm/controls/OrbitControls.js',
            'three/examples/jsm/loaders/FBXLoader.js',
            'three/examples/jsm/loaders/GLTFLoader.js'
        ]
    }
} 