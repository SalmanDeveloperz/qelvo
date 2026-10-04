// Template facts the UI needs: kept separate so the landing page doesn't pull in the typesetter.
import type { ContactKind, TemplateId } from "../model/types";

/** Contacts that are profile links: the kinds Modern and Two-Column TeX mark with an icon by default. */
export const PROFILE_KINDS = new Set<ContactKind>(["linkedin", "github", "website", "twitter"]);

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  tagline: string;
  twoColumn: boolean;
  /** Default contact icons: profile links only, or none unless the user ticks them. */
  profileIcons: boolean;
  /** Default name weight: every word bold, or only the surname (light given names). */
  nameWeight: "all" | "last";
}

export const TEMPLATE_META: Record<TemplateId, TemplateMeta> = {
  classic: {
    id: "classic",
    name: "Classic TeX",
    tagline: "Single column · Computer Modern · the layout recruiters have read ten thousand times",
    twoColumn: false,
    profileIcons: false,
    nameWeight: "all",
  },
  academic: {
    id: "academic",
    name: "Two-Column TeX",
    tagline: "Latin Modern · experience left, skills right · dense without feeling crowded",
    twoColumn: true,
    profileIcons: true,
    nameWeight: "all",
  },
  modern: {
    id: "modern",
    name: "Modern Sans",
    tagline: "Poppins · two columns · clean geometric type for product-minded engineers",
    twoColumn: true,
    profileIcons: true,
    nameWeight: "last",
  },
  blueprint: {
    id: "blueprint",
    name: "Blueprint",
    tagline: "Source Sans · blue small-caps headings · aligned skills and project links, built for full-stack roles",
    twoColumn: false,
    profileIcons: false,
    nameWeight: "all",
  },
};
