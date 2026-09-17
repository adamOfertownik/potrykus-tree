import type { MetadataRoute } from "next";

/** Private family tree — crawlers must not index any URL. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
