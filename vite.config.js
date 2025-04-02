export default {
    root: '.',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        minify: 'terser',
        sourcemap: false,
        emptyOutDir: true,
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
    preview: {
        port: 3000
    },
    resolve: {
        alias: {
            '@': '/src'
        }
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