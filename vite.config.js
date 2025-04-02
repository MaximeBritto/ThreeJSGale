export default {
    root: '.',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        assetsDir: 'assets'
    },
    server: {
        port: 3000,
        open: true
    },
    resolve: {
        alias: {
            '@': '/src'
        }
    }
} 