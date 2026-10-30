/** @type {import('next').NextConfig} */
// Exportação estática: todas as páginas são estáticas, então o container final é só um nginx minúsculo.
module.exports = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};
