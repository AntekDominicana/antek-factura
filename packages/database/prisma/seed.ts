import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando Seeder de Catálogos Oficiales DGII & Planes SaaS ---');

  // 1. Provincias Oficiales DGII
  const provinces = [
    { codigo: '10000', nombre: 'DISTRITO NACIONAL' },
    { codigo: '20000', nombre: 'PROVINCIA AZUA' },
    { codigo: '30000', nombre: 'PROVINCIA BAHORUCO' },
    { codigo: '40000', nombre: 'PROVINCIA BARAHONA' },
    { codigo: '50000', nombre: 'PROVINCIA DAJABÓN' },
    { codigo: '60000', nombre: 'PROVINCIA DUARTE' },
    { codigo: '70000', nombre: 'PROVINCIA ELÍAS PIÑA' },
    { codigo: '80000', nombre: 'PROVINCIA EL SEIBO' },
    { codigo: '90000', nombre: 'PROVINCIA ESPAILLAT' },
    { codigo: '100000', nombre: 'PROVINCIA INDEPENDENCIA' },
    { codigo: '110000', nombre: 'PROVINCIA LA ALTAGRACIA' },
    { codigo: '120000', nombre: 'PROVINCIA LA ROMANA' },
    { codigo: '130000', nombre: 'PROVINCIA LA VEGA' },
    { codigo: '140000', nombre: 'PROVINCIA MARÍA TRINIDAD SÁNCHEZ' },
    { codigo: '150000', nombre: 'PROVINCIA MONTE CRISTI' },
    { codigo: '160000', nombre: 'PROVINCIA PEDERNALES' },
    { codigo: '170000', nombre: 'PROVINCIA PERAVIA' },
    { codigo: '180000', nombre: 'PROVINCIA PUERTO PLATA' },
    { codigo: '190000', nombre: 'PROVINCIA HERMANAS MIRABAL' },
    { codigo: '200000', nombre: 'PROVINCIA SAMANÁ' },
    { codigo: '210000', nombre: 'PROVINCIA SAN CRISTÓBAL' },
    { codigo: '220000', nombre: 'PROVINCIA SAN JUAN' },
    { codigo: '230000', nombre: 'PROVINCIA SAN PEDRO DE MACORÍS' },
    { codigo: '240000', nombre: 'PROVINCIA SANCHEZ RAMÍREZ' },
    { codigo: '250000', nombre: 'PROVINCIA SANTIAGO' },
    { codigo: '260000', nombre: 'PROVINCIA SANTIAGO RODRÍGUEZ' },
    { codigo: '270000', nombre: 'PROVINCIA VALVERDE' },
    { codigo: '280000', nombre: 'PROVINCIA MONSEÑOR NOUEL' },
    { codigo: '290000', nombre: 'PROVINCIA MONTE PLATA' },
    { codigo: '300000', nombre: 'PROVINCIA HATO MAYOR' },
    { codigo: '310000', nombre: 'PROVINCIA SAN JOSÉ DE OCOA' },
    { codigo: '320000', nombre: 'PROVINCIA SANTO DOMINGO' },
  ];

  for (const prov of provinces) {
    await prisma.catalogProvince.upsert({
      where: { codigo: prov.codigo },
      update: { nombre: prov.nombre },
      create: prov,
    });
  }
  console.log(`✓ ${provinces.length} Provincias registradas`);

  // 2. Municipios Oficiales DGII
  const municipalities = [
    { codigo: '10100', provinciaCodigo: '10000', nombre: 'MUNICIPIO SANTO DOMINGO DE GUZMÁN' },
    { codigo: '20100', provinciaCodigo: '20000', nombre: 'MUNICIPIO AZUA' },
    { codigo: '20200', provinciaCodigo: '20000', nombre: 'MUNICIPIO LAS CHARCAS' },
    { codigo: '20300', provinciaCodigo: '20000', nombre: 'MUNICIPIO LAS YAYAS DE VIAJAMA' },
    { codigo: '20400', provinciaCodigo: '20000', nombre: 'MUNICIPIO PADRE LAS CASAS' },
    { codigo: '20500', provinciaCodigo: '20000', nombre: 'MUNICIPIO PERALTA' },
    { codigo: '20600', provinciaCodigo: '20000', nombre: 'MUNICIPIO SABANA YEGUA' },
    { codigo: '20700', provinciaCodigo: '20000', nombre: 'MUNICIPIO PUEBLO VIEJO' },
    { codigo: '20800', provinciaCodigo: '20000', nombre: 'MUNICIPIO TÁBARA ARRIBA' },
    { codigo: '20900', provinciaCodigo: '20000', nombre: 'MUNICIPIO GUAYABAL' },
    { codigo: '21000', provinciaCodigo: '20000', nombre: 'MUNICIPIO ESTEBANÍA' },
    { codigo: '30200', provinciaCodigo: '30000', nombre: 'MUNICIPIO GALVÁN' },
    { codigo: '30300', provinciaCodigo: '30000', nombre: 'MUNICIPIO TAMAYO' },
    { codigo: '30400', provinciaCodigo: '30000', nombre: 'MUNICIPIO VILLA JARAGUA' },
    { codigo: '30500', provinciaCodigo: '30000', nombre: 'MUNICIPIO LOS RÍOS' },
    { codigo: '40100', provinciaCodigo: '40000', nombre: 'MUNICIPIO BARAHONA' },
    { codigo: '40200', provinciaCodigo: '40000', nombre: 'MUNICIPIO CABRAL' },
    { codigo: '40300', provinciaCodigo: '40000', nombre: 'MUNICIPIO ENRIQUILLO' },
    { codigo: '40400', provinciaCodigo: '40000', nombre: 'MUNICIPIO PARAÍSO' },
    { codigo: '40500', provinciaCodigo: '40000', nombre: 'MUNICIPIO VICENTE NOBLE' },
    { codigo: '40600', provinciaCodigo: '40000', nombre: 'MUNICIPIO EL PEÑÓN' },
    { codigo: '40700', provinciaCodigo: '40000', nombre: 'MUNICIPIO LA CIÉNAGA' },
    { codigo: '40800', provinciaCodigo: '40000', nombre: 'MUNICIPIO FUNDACIÓN' },
    { codigo: '40900', provinciaCodigo: '40000', nombre: 'MUNICIPIO LAS SALINAS' },
    { codigo: '41000', provinciaCodigo: '40000', nombre: 'MUNICIPIO POLO' },
    { codigo: '41100', provinciaCodigo: '40000', nombre: 'MUNICIPIO JAQUIMEYES' },
    { codigo: '50100', provinciaCodigo: '50000', nombre: 'MUNICIPIO DAJABÓN' },
    { codigo: '50200', provinciaCodigo: '50000', nombre: 'MUNICIPIO LOMA DE CABRERA' },
    { codigo: '50300', provinciaCodigo: '50000', nombre: 'MUNICIPIO PARTIDO' },
    { codigo: '50400', provinciaCodigo: '50000', nombre: 'MUNICIPIO RESTAURACIÓN' },
    { codigo: '50500', provinciaCodigo: '50000', nombre: 'MUNICIPIO EL PINO' },
    { codigo: '60100', provinciaCodigo: '60000', nombre: 'MUNICIPIO SAN FRANCISCO DE MACORÍS' },
    { codigo: '60200', provinciaCodigo: '60000', nombre: 'MUNICIPIO ARENOSO' },
    { codigo: '60300', provinciaCodigo: '60000', nombre: 'MUNICIPIO CASTILLO' },
    { codigo: '60400', provinciaCodigo: '60000', nombre: 'MUNICIPIO PIMENTEL' },
    { codigo: '60500', provinciaCodigo: '60000', nombre: 'MUNICIPIO VILLA RIVA' },
    { codigo: '60600', provinciaCodigo: '60000', nombre: 'MUNICIPIO LAS GUÁRANAS' },
    { codigo: '60700', provinciaCodigo: '60000', nombre: 'MUNICIPIO EUGENIO MARÍA DE HOSTOS' },
    { codigo: '70100', provinciaCodigo: '70000', nombre: 'MUNICIPIO COMENDADOR' },
    { codigo: '70200', provinciaCodigo: '70000', nombre: 'MUNICIPIO BÁNICA' },
    { codigo: '70300', provinciaCodigo: '70000', nombre: 'MUNICIPIO EL LLANO' },
    { codigo: '70400', provinciaCodigo: '70000', nombre: 'MUNICIPIO HONDO VALLE' },
    { codigo: '70500', provinciaCodigo: '70000', nombre: 'MUNICIPIO PEDRO SANTANA' },
    { codigo: '70600', provinciaCodigo: '70000', nombre: 'MUNICIPIO JUAN SANTIAGO' },
    { codigo: '80100', provinciaCodigo: '80000', nombre: 'MUNICIPIO EL SEIBO' },
    { codigo: '80200', provinciaCodigo: '80000', nombre: 'MUNICIPIO MICHES' },
    { codigo: '90100', provinciaCodigo: '90000', nombre: 'MUNICIPIO MOCA' },
    { codigo: '90200', provinciaCodigo: '90000', nombre: 'MUNICIPIO CAYETANO GERMOSÉN' },
    { codigo: '90300', provinciaCodigo: '90000', nombre: 'MUNICIPIO GASPAR HERNÁNDEZ' },
    { codigo: '90400', provinciaCodigo: '90000', nombre: 'MUNICIPIO JAMAO AL NORTE' },
    { codigo: '100100', provinciaCodigo: '100000', nombre: 'MUNICIPIO JIMANÍ' },
    { codigo: '100200', provinciaCodigo: '100000', nombre: 'MUNICIPIO DUVERGÉ' },
    { codigo: '100300', provinciaCodigo: '100000', nombre: 'MUNICIPIO LA DESCUBIERTA' },
    { codigo: '100400', provinciaCodigo: '100000', nombre: 'MUNICIPIO POSTRER RÍO' },
    { codigo: '100500', provinciaCodigo: '100000', nombre: 'MUNICIPIO CRISTÓBAL' },
    { codigo: '100600', provinciaCodigo: '100000', nombre: 'MUNICIPIO MELLA' },
    { codigo: '110100', provinciaCodigo: '110000', nombre: 'MUNICIPIO HIGÜEY' },
    { codigo: '110200', provinciaCodigo: '110000', nombre: 'MUNICIPIO SAN RAFAEL DEL YUMA' },
    { codigo: '120100', provinciaCodigo: '120000', nombre: 'MUNICIPIO LA ROMANA' },
    { codigo: '120200', provinciaCodigo: '120000', nombre: 'MUNICIPIO GUAYMATE' },
    { codigo: '120300', provinciaCodigo: '120000', nombre: 'MUNICIPIO VILLA HERMOSA' },
    { codigo: '130100', provinciaCodigo: '130000', nombre: 'MUNICIPIO LA VEGA' },
    { codigo: '130200', provinciaCodigo: '130000', nombre: 'MUNICIPIO CONSTANZA' },
    { codigo: '130300', provinciaCodigo: '130000', nombre: 'MUNICIPIO JARABACOA' },
    { codigo: '130400', provinciaCodigo: '130000', nombre: 'MUNICIPIO JIMA ABAJO' },
    { codigo: '140100', provinciaCodigo: '140000', nombre: 'MUNICIPIO NAGUA' },
    { codigo: '140200', provinciaCodigo: '140000', nombre: 'MUNICIPIO CABRERA' },
    { codigo: '140300', provinciaCodigo: '140000', nombre: 'MUNICIPIO EL FACTOR' },
    { codigo: '140400', provinciaCodigo: '140000', nombre: 'MUNICIPIO RÍO SAN JUAN' },
    { codigo: '150100', provinciaCodigo: '150000', nombre: 'MUNICIPIO MONTE CRISTI' },
    { codigo: '150200', provinciaCodigo: '150000', nombre: 'MUNICIPIO CASTAÑUELAS' },
    { codigo: '150300', provinciaCodigo: '150000', nombre: 'MUNICIPIO GUAYUBÍN' },
    { codigo: '150400', provinciaCodigo: '150000', nombre: 'MUNICIPIO LAS MATAS DE SANTA CRUZ' },
    { codigo: '150500', provinciaCodigo: '150000', nombre: 'MUNICIPIO PEPILLO SALCEDO' },
    { codigo: '150600', provinciaCodigo: '150000', nombre: 'MUNICIPIO VILLA VÁSQUEZ' },
    { codigo: '160100', provinciaCodigo: '160000', nombre: 'MUNICIPIO PEDERNALES' },
    { codigo: '160200', provinciaCodigo: '160000', nombre: 'MUNICIPIO OVIEDO' },
    { codigo: '170100', provinciaCodigo: '170000', nombre: 'MUNICIPIO BANÍ' },
    { codigo: '170200', provinciaCodigo: '170000', nombre: 'MUNICIPIO NIZAO' },
    { codigo: '170300', provinciaCodigo: '170000', nombre: 'MATANZAS' },
    { codigo: '180100', provinciaCodigo: '180000', nombre: 'MUNICIPIO PUERTO PLATA' },
    { codigo: '180200', provinciaCodigo: '180000', nombre: 'MUNICIPIO ALTAMIRA' },
    { codigo: '180300', provinciaCodigo: '180000', nombre: 'MUNICIPIO GUANANICO' },
    { codigo: '180400', provinciaCodigo: '180000', nombre: 'MUNICIPIO IMBERT' },
    { codigo: '180500', provinciaCodigo: '180000', nombre: 'MUNICIPIO LOS HIDALGOS' },
    { codigo: '180600', provinciaCodigo: '180000', nombre: 'MUNICIPIO LUPERÓN' },
    { codigo: '180700', provinciaCodigo: '180000', nombre: 'MUNICIPIO SOSÚA' },
    { codigo: '180800', provinciaCodigo: '180000', nombre: 'MUNICIPIO VILLA ISABELA' },
    { codigo: '180900', provinciaCodigo: '180000', nombre: 'MUNICIPIO VILLA MONTELLANO' },
    { codigo: '190100', provinciaCodigo: '190000', nombre: 'MUNICIPIO SALCEDO' },
    { codigo: '190200', provinciaCodigo: '190000', nombre: 'MUNICIPIO TENARES' },
    { codigo: '190300', provinciaCodigo: '190000', nombre: 'MUNICIPIO VILLA TAPIA' },
    { codigo: '200100', provinciaCodigo: '200000', nombre: 'MUNICIPIO SAMANÁ' },
    { codigo: '200200', provinciaCodigo: '200000', nombre: 'MUNICIPIO SÁNCHEZ' },
    { codigo: '200300', provinciaCodigo: '200000', nombre: 'MUNICIPIO LAS TERRENAS' },
    { codigo: '210100', provinciaCodigo: '210000', nombre: 'MUNICIPIO SAN CRISTÓBAL' },
    { codigo: '210200', provinciaCodigo: '210000', nombre: 'MUNICIPIO SABANA GRANDE DE PALENQUE' },
    { codigo: '210300', provinciaCodigo: '210000', nombre: 'MUNICIPIO BAJOS DE HAINA' },
    { codigo: '210400', provinciaCodigo: '210000', nombre: 'MUNICIPIO CAMBITA GARABITOS' },
    { codigo: '210500', provinciaCodigo: '210000', nombre: 'MUNICIPIO VILLA ALTAGRACIA' },
    { codigo: '210600', provinciaCodigo: '210000', nombre: 'MUNICIPIO YAGUATE' },
    { codigo: '210700', provinciaCodigo: '210000', nombre: 'MUNICIPIO SAN GREGORIO DE NIGUA' },
    { codigo: '210800', provinciaCodigo: '210000', nombre: 'MUNICIPIO LOS CACAOS' },
    { codigo: '220100', provinciaCodigo: '220000', nombre: 'MUNICIPIO SAN JUAN' },
    { codigo: '220200', provinciaCodigo: '220000', nombre: 'MUNICIPIO BOHECHÍO' },
    { codigo: '220300', provinciaCodigo: '220000', nombre: 'MUNICIPIO EL CERCADO' },
    { codigo: '220400', provinciaCodigo: '220000', nombre: 'MUNICIPIO JUAN DE HERRERA' },
    { codigo: '220500', provinciaCodigo: '220000', nombre: 'MUNICIPIO LAS MATAS DE FARFÁN' },
    { codigo: '230100', provinciaCodigo: '230000', nombre: 'MUNICIPIO SAN PEDRO DE MACORÍS' },
    { codigo: '230200', provinciaCodigo: '230000', nombre: 'MUNICIPIO LOS LLANOS' },
    { codigo: '230300', provinciaCodigo: '230000', nombre: 'MUNICIPIO RAMÓN SANTANA' },
    { codigo: '230400', provinciaCodigo: '230000', nombre: 'MUNICIPIO CONSUELO' },
    { codigo: '230500', provinciaCodigo: '230000', nombre: 'MUNICIPIO QUISQUEYA' },
    { codigo: '230600', provinciaCodigo: '230000', nombre: 'MUNICIPIO GUAYACANES' },
    { codigo: '240100', provinciaCodigo: '240000', nombre: 'MUNICIPIO COTUÍ' },
    { codigo: '240200', provinciaCodigo: '240000', nombre: 'MUNICIPIO CEVICOS' },
    { codigo: '240300', provinciaCodigo: '240000', nombre: 'MUNICIPIO FANTINO' },
    { codigo: '240400', provinciaCodigo: '240000', nombre: 'MUNICIPIO LA MATA' },
    { codigo: '250100', provinciaCodigo: '250000', nombre: 'MUNICIPIO SANTIAGO' },
    { codigo: '250200', provinciaCodigo: '250000', nombre: 'MUNICIPIO BISONÓ' },
    { codigo: '250300', provinciaCodigo: '250000', nombre: 'MUNICIPIO JÁNICO' },
    { codigo: '250400', provinciaCodigo: '250000', nombre: 'MUNICIPIO LICEY AL MEDIO' },
    { codigo: '250500', provinciaCodigo: '250000', nombre: 'MUNICIPIO SAN JOSÉ DE LAS MATAS' },
    { codigo: '250600', provinciaCodigo: '250000', nombre: 'MUNICIPIO TAMBORIL' },
    { codigo: '250700', provinciaCodigo: '250000', nombre: 'MUNICIPIO VILLA GONZÁLEZ' },
    { codigo: '250800', provinciaCodigo: '250000', nombre: 'MUNICIPIO PUÑAL' },
    { codigo: '250900', provinciaCodigo: '250000', nombre: 'MUNICIPIO SABANA IGLESIA' },
    { codigo: '251000', provinciaCodigo: '250000', nombre: 'BAITOA' },
    { codigo: '260100', provinciaCodigo: '260000', nombre: 'MUNICIPIO SAN IGNACIO DE SABANETA' },
    { codigo: '260200', provinciaCodigo: '260000', nombre: 'MUNICIPIO VILLA LOS ALMÁCIGOS' },
    { codigo: '260300', provinciaCodigo: '260000', nombre: 'MUNICIPIO MONCIÓN' },
    { codigo: '270100', provinciaCodigo: '270000', nombre: 'MUNICIPIO MAO' },
    { codigo: '270200', provinciaCodigo: '270000', nombre: 'MUNICIPIO ESPERANZA' },
    { codigo: '270300', provinciaCodigo: '270000', nombre: 'MUNICIPIO LAGUNA SALADA' },
    { codigo: '280100', provinciaCodigo: '280000', nombre: 'MUNICIPIO BONAO' },
    { codigo: '280200', provinciaCodigo: '280000', nombre: 'MUNICIPIO MAIMÓN' },
    { codigo: '280300', provinciaCodigo: '280000', nombre: 'MUNICIPIO PIEDRA BLANCA' },
    { codigo: '290100', provinciaCodigo: '290000', nombre: 'MUNICIPIO MONTE PLATA' },
    { codigo: '290200', provinciaCodigo: '290000', nombre: 'MUNICIPIO BAYAGUANA' },
    { codigo: '290300', provinciaCodigo: '290000', nombre: 'MUNICIPIO SABANA GRANDE DE BOYÁ' },
    { codigo: '290400', provinciaCodigo: '290000', nombre: 'MUNICIPIO YAMASÁ' },
    { codigo: '290500', provinciaCodigo: '290000', nombre: 'MUNICIPIO PERALVILLO' },
    { codigo: '300100', provinciaCodigo: '300000', nombre: 'MUNICIPIO HATO MAYOR' },
    { codigo: '300200', provinciaCodigo: '300000', nombre: 'MUNICIPIO SABANA DE LA MAR' },
    { codigo: '300300', provinciaCodigo: '300000', nombre: 'MUNICIPIO EL VALLE' },
    { codigo: '310100', provinciaCodigo: '310000', nombre: 'MUNICIPIO SAN JOSÉ DE OCOA' },
    { codigo: '310200', provinciaCodigo: '310000', nombre: 'MUNICIPIO SABANA LARGA' },
    { codigo: '310300', provinciaCodigo: '310000', nombre: 'MUNICIPIO RANCHO ARRIBA' },
    { codigo: '320100', provinciaCodigo: '320000', nombre: 'MUNICIPIO SANTO DOMINGO ESTE' },
    { codigo: '320200', provinciaCodigo: '320000', nombre: 'MUNICIPIO SANTO DOMINGO OESTE' },
    { codigo: '320300', provinciaCodigo: '320000', nombre: 'MUNICIPIO SANTO DOMINGO NORTE' },
    { codigo: '320400', provinciaCodigo: '320000', nombre: 'MUNICIPIO BOCA CHICA' },
    { codigo: '320500', provinciaCodigo: '320000', nombre: 'MUNICIPIO SAN ANTONIO DE GUERRA' },
    { codigo: '320600', provinciaCodigo: '320000', nombre: 'MUNICIPIO LOS ALCARRIZOS' },
    { codigo: '320700', provinciaCodigo: '320000', nombre: 'MUNICIPIO PEDRO BRAND' },
  ];

  for (const mun of municipalities) {
    await prisma.catalogMunicipality.upsert({
      where: { codigo: mun.codigo },
      update: { nombre: mun.nombre, provinciaCodigo: mun.provinciaCodigo },
      create: mun,
    });
  }
  console.log(`✓ ${municipalities.length} Municipios registrados`);

  // 3. Unidades de Medida Oficiales DGII (Tabla 5.6)
  const units = [
    { codigo: 1, descripcion: 'Barril' },
    { codigo: 2, descripcion: 'Bolsa' },
    { codigo: 3, descripcion: 'Bote' },
    { codigo: 4, descripcion: 'Bultos' },
    { codigo: 5, descripcion: 'Botella' },
    { codigo: 6, descripcion: 'Caja/Cajón' },
    { codigo: 7, descripcion: 'Cajetilla' },
    { codigo: 8, descripcion: 'Centímetro' },
    { codigo: 9, descripcion: 'Cilindro' },
    { codigo: 10, descripcion: 'Conjunto' },
    { codigo: 11, descripcion: 'Contenedor' },
    { codigo: 12, descripcion: 'Día' },
    { codigo: 13, descripcion: 'Docena' },
    { codigo: 14, descripcion: 'Fardo' },
    { codigo: 15, descripcion: 'Galones' },
    { codigo: 16, descripcion: 'Grado' },
    { codigo: 17, descripcion: 'Gramo' },
    { codigo: 18, descripcion: 'Granel' },
    { codigo: 19, descripcion: 'Hora' },
    { codigo: 20, descripcion: 'Huacal' },
    { codigo: 21, descripcion: 'Kilogramo' },
    { codigo: 22, descripcion: 'Kilovatio Hora' },
    { codigo: 23, descripcion: 'Libra' },
    { codigo: 24, descripcion: 'Litro' },
    { codigo: 25, descripcion: 'Lote' },
    { codigo: 26, descripcion: 'Metro' },
    { codigo: 27, descripcion: 'Metro Cuadrado' },
    { codigo: 28, descripcion: 'Metro Cúbico' },
    { codigo: 29, descripcion: 'Millones de Unidades Térmicas' },
    { codigo: 30, descripcion: 'Minuto' },
    { codigo: 31, descripcion: 'Paquete' },
    { codigo: 32, descripcion: 'Par' },
    { codigo: 33, descripcion: 'Pie' },
    { codigo: 34, descripcion: 'Pieza' },
    { codigo: 35, descripcion: 'Rollo' },
    { codigo: 36, descripcion: 'Sobre' },
    { codigo: 37, descripcion: 'Segundo' },
    { codigo: 38, descripcion: 'Tanque' },
    { codigo: 39, descripcion: 'Tonelada' },
    { codigo: 40, descripcion: 'Tubo' },
    { codigo: 41, descripcion: 'Yarda' },
    { codigo: 42, descripcion: 'Yarda cuadrada' },
    { codigo: 43, descripcion: 'Unidad' }, // Por defecto
    { codigo: 44, descripcion: 'Elemento' },
    { codigo: 45, descripcion: 'Millar' },
    { codigo: 46, descripcion: 'Saco' },
    { codigo: 47, descripcion: 'Lata' },
    { codigo: 48, descripcion: 'Display' },
    { codigo: 49, descripcion: 'Bidón' },
    { codigo: 50, descripcion: 'Ración' },
    { codigo: 51, descripcion: 'Quintal' },
    { codigo: 52, descripcion: 'Toneladas de registro bruto' },
    { codigo: 53, descripcion: 'Pie Cuadrado' },
    { codigo: 54, descripcion: 'Pasajero' },
    { codigo: 55, descripcion: 'Pulgadas' },
    { codigo: 56, descripcion: 'Parqueo Barcos En Muelle' },
    { codigo: 57, descripcion: 'Bandeja' },
  ];

  for (const unit of units) {
    await prisma.catalogUnitOfMeasure.upsert({
      where: { codigo: unit.codigo },
      update: { descripcion: unit.descripcion },
      create: unit,
    });
  }
  console.log(`✓ ${units.length} Unidades de Medida registradas`);

  // 4. Impuestos Adicionales Oficiales DGII (Tabla 5.4)
  const additionalTaxes = [
    { codigo: '001', tipoImpuesto: 'Propina Legal', abreviatura: 'Propina Legal', descripcion: 'Propina Legal 10%', tasa: 10.00 },
    { codigo: '002', tipoImpuesto: 'Contribución al Desarrollo de las Telecomunicaciones', abreviatura: 'CDT', descripcion: 'CDT Ley 153-98 Art. 45', tasa: 2.00 },
    { codigo: '003', tipoImpuesto: 'Impuesto Selectivo al Consumo', abreviatura: 'ISC', descripcion: 'Servicios Seguros en general', tasa: 16.00 },
    { codigo: '004', tipoImpuesto: 'Impuesto Selectivo al Consumo', abreviatura: 'ISC', descripcion: 'Servicios de Telecomunicaciones', tasa: 10.00 },
    { codigo: '005', tipoImpuesto: 'Impuesto sobre el Primer Registro de Vehículos', abreviatura: 'Primera Placa', descripcion: 'Expedición de la primera placa', tasa: 17.00 },
    // ISC Específico
    { codigo: '006', tipoImpuesto: 'ISC Específico', abreviatura: 'ISC Específico', descripcion: 'Cerveza', tasa: 632.58 },
    { codigo: '007', tipoImpuesto: 'ISC Específico', abreviatura: 'ISC Específico', descripcion: 'Vinos de uva', tasa: 632.58 },
    { codigo: '013', tipoImpuesto: 'ISC Específico', abreviatura: 'ISC Específico', descripcion: 'Whisky', tasa: 632.58 },
    { codigo: '014', tipoImpuesto: 'ISC Específico', abreviatura: 'ISC Específico', descripcion: 'Ron y demás aguardientes de caña', tasa: 632.58 },
    // ISC Ad Valorem
    { codigo: '023', tipoImpuesto: 'ISC Ad Valorem', abreviatura: 'ISC Ad Valorem', descripcion: 'Cerveza', tasa: 10.00 },
    { codigo: '024', tipoImpuesto: 'ISC Ad Valorem', abreviatura: 'ISC Ad Valorem', descripcion: 'Vinos de uva', tasa: 10.00 },
    { codigo: '030', tipoImpuesto: 'ISC Ad Valorem', abreviatura: 'ISC Ad Valorem', descripcion: 'Whisky', tasa: 10.00 },
    { codigo: '031', tipoImpuesto: 'ISC Ad Valorem', abreviatura: 'ISC Ad Valorem', descripcion: 'Ron y demás aguardientes de caña', tasa: 10.00 },
  ];

  for (const tax of additionalTaxes) {
    await prisma.catalogAdditionalTax.upsert({
      where: { codigo: tax.codigo },
      update: { tipoImpuesto: tax.tipoImpuesto, abreviatura: tax.abreviatura, descripcion: tax.descripcion, tasa: tax.tasa },
      create: tax,
    });
  }
  console.log(`✓ ${additionalTaxes.length} Impuestos Adicionales registrados`);

  // 5. Monedas Oficiales DGII (Tabla 5.5)
  const currencies = [
    { codigo: 'USD', descripcion: 'DOLAR ESTADOUNIDENSE' },
    { codigo: 'EUR', descripcion: 'EURO' },
    { codigo: 'CAD', descripcion: 'DOLAR CANADIENSE' },
    { codigo: 'CHF', descripcion: 'FRANCO SUIZO' },
    { codigo: 'GBP', descripcion: 'LIBRA ESTERLINA' },
    { codigo: 'BRL', descripcion: 'REAL BRASILEÑO' },
    { codigo: 'JPY', descripcion: 'YEN JAPONES' },
    { codigo: 'CHY', descripcion: 'YUAN CHINO' },
    { codigo: 'DKK', descripcion: 'CORONA DANESA' },
    { codigo: 'NOK', descripcion: 'CORONA NORUEGA' },
    { codigo: 'SEK', descripcion: 'CORONA SUECA' },
  ];

  for (const curr of currencies) {
    await prisma.catalogCurrency.upsert({
      where: { codigo: curr.codigo },
      update: { descripcion: curr.descripcion },
      create: curr,
    });
  }
  console.log(`✓ ${currencies.length} Monedas registradas`);

  // 6. Planes SaaS Oficiales de Suscripción (BASIC, MEDIUM, PRO)
  const plans = [
    {
      code: 'BASIC',
      name: 'Plan Básico',
      description: 'Ideal para pequeños negocios, comercios y profesionales independientes.',
      priceDop: 990.0,
      priceUsd: 18.0,
      monthlyInvoiceLimit: 100,
      maxUsers: 2,
      maxBranches: 1,
      allowedEcfTypes: [31, 32],
      apiAccess: false,
      isActive: true,
    },
    {
      code: 'MEDIUM',
      name: 'Plan Medio',
      description: 'Para empresas en crecimiento con alto volumen de facturación y sucursales.',
      priceDop: 2450.0,
      priceUsd: 45.0,
      monthlyInvoiceLimit: 600,
      maxUsers: 5,
      maxBranches: 3,
      allowedEcfTypes: [31, 32, 33, 34, 44, 45],
      apiAccess: true,
      isActive: true,
    },
    {
      code: 'PRO',
      name: 'Plan Pro',
      description: 'Para corporaciones, distribuidoras y cadenas con emisión masiva y multimoneda.',
      priceDop: 4900.0,
      priceUsd: 90.0,
      monthlyInvoiceLimit: 3000,
      maxUsers: 25,
      maxBranches: 10,
      allowedEcfTypes: [31, 32, 33, 34, 41, 43, 44, 45, 46, 47],
      apiAccess: true,
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        priceDop: plan.priceDop,
        priceUsd: plan.priceUsd,
        monthlyInvoiceLimit: plan.monthlyInvoiceLimit,
        maxUsers: plan.maxUsers,
        maxBranches: plan.maxBranches,
        allowedEcfTypes: plan.allowedEcfTypes,
        apiAccess: plan.apiAccess,
        isActive: plan.isActive,
      },
      create: plan,
    });
  }
  console.log(`✓ ${plans.length} Planes de suscripción registrados`);

  console.log('--- Seeder completado exitosamente ---');
}

main()
  .catch((e) => {
    console.error('Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
