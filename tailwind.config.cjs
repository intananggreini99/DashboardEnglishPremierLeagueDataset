module.exports = {
  content: ["./frontend/*.html", "./frontend/js/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: { ink: "#e9f1ec", paper: "#060907" },
    },
  },
  plugins: [],
};
