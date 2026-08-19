import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'chargewise',
  primaryShade: 7,
  colors: {
    chargewise: [
      '#eef8f1',
      '#dcefe2',
      '#b9dfc6',
      '#91cda7',
      '#64b884',
      '#3c9d65',
      '#238653',
      '#167a4b',
      '#0d5d38',
      '#073f26',
    ],
  },
  fontFamily: 'Inter, Avenir, "Segoe UI", sans-serif',
  headings: { fontFamily: 'Inter, Avenir, "Segoe UI", sans-serif' },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Button: {
      defaultProps: { radius: 'md' },
    },
    Input: {
      defaultProps: { radius: 'md' },
    },
    Modal: {
      defaultProps: { radius: 'lg', centered: true },
    },
  },
})
