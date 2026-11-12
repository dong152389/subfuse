import { MetadataRoute } from "next";
import { createSubFuseManifest } from "@subfuse/ui/brand";

export default function manifest(): MetadataRoute.Manifest {
  return createSubFuseManifest();
}
