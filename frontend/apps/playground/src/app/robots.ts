import type { MetadataRoute } from "next";

// 미공개 시안이 올라오는 곳이라 검색엔진에 잡히면 안 된다.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
