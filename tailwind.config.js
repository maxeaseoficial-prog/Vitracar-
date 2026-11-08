export default {
  content: ['./index.html', './src/*.tsx', './src/pages/*.tsx', './src/components/*.tsx', './src/lib/*.tsx'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eaf2ff', 100: '#d9e9ff', 500: '#1565d8', 600: '#1259bf', 700: '#0c4598' },
        ink: '#17212f'
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: [],
}
