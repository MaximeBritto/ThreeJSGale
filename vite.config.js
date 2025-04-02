export default {
    root: '.',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        minify: 'esbuild',
        sourcemap: false,
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    three: ['three']
                }
            }
        },
        assetsInlineLimit: 0
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
            '@': '/src',
            'three': 'three'
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