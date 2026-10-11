export type StorefrontCollection = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  categorySlugs: readonly string[];
};

export const storefrontCollections: StorefrontCollection[] = [
  {
    slug: "work-and-productivity",
    eyebrow: "Trabalho e produtividade",
    title: "Prepare o seu espaço de trabalho",
    description: "Portáteis, monitores e equipamento para trabalhar com mais conforto.",
    image: "/pc_01.png",
    categorySlugs: ["computadores", "monitores", "acessorios", "redes", "impressao"],
  },
  {
    slug: "study-and-mobility",
    eyebrow: "Estudo e mobilidade",
    title: "Tecnologia para levar consigo",
    description: "Computadores, smartphones e acessórios para estudar onde precisar.",
    image: "/Iphone_15.png",
    categorySlugs: ["computadores", "smartphones", "acessorios"],
  },
  {
    slug: "build-your-setup",
    eyebrow: "O seu setup",
    title: "Complete ou melhore o seu setup",
    description: "Componentes, monitores e acessórios para completar a sua configuração.",
    image: "/Componentes.png",
    categorySlugs: ["componentes", "monitores", "acessorios"],
  },
];

export function getStorefrontCollection(slug: string) {
  return storefrontCollections.find((collection) => collection.slug === slug);
}
