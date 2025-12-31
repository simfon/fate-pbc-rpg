module.exports = {
  content: [
    './src/views/**/*.ejs',
    './src/**/*.ts',
    './dist/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        parchment: '#f4e4bc',
        ink: '#2c1810',
        gold: '#c9a227',
        blood: '#8b0000',
        midnight: '#1a1a2e',
        mist: '#e8e4e0',
      },
      fontFamily: {
        title: ['Cinzel', 'serif'],
        body: ['Crimson Text', 'serif'],
      }
    },
  },
  plugins: [],
};
