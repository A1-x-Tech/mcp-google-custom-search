import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleCustomSearchClient } from "../client.js";
import { checkPageWindow, fail, ok, READ_ONLY } from "./util.js";
import { searchInputFields, toSearchParams } from "./search.js";

export function registerImageTools(server: McpServer, client: GoogleCustomSearchClient): void {
  server.registerTool(
    "search_images",
    {
      title: "Image search",
      annotations: READ_ONLY,
      description:
        "Image search through your Google Programmable Search Engine (searchType=image). Works only when " +
        'the engine has "Image search" enabled in its control panel — otherwise the API answers 400. Each ' +
        "item's url is the image file itself; image.context_url is the page hosting it, with " +
        "width/height/byte_size and a thumbnail_url (plus its dimensions) for previews. Everything else " +
        "matches the search tool: same filters (language/country, safe search, site include/exclude, " +
        "date_restrict, file_type, rights — use rights for reusable images), same pagination " +
        "(max 10 per call, 100 per query, paginate via next_start), same quota (one unit per call). " +
        "Image-only filters: size (icon..huge), type (clipart/face/lineart/stock/photo/animated), " +
        "color_type (mono/gray/color/trans) and dominant_color.",
      inputSchema: {
        ...searchInputFields(),
        size: z
          .enum(["icon", "small", "medium", "large", "xlarge", "xxlarge", "huge"])
          .optional()
          .describe("Image size class, from icon to huge."),
        type: z
          .enum(["clipart", "face", "lineart", "stock", "photo", "animated"])
          .optional()
          .describe("Kind of image."),
        color_type: z
          .enum(["mono", "gray", "color", "trans"])
          .optional()
          .describe("mono = black & white, trans = transparent background."),
        dominant_color: z
          .enum([
            "black",
            "blue",
            "brown",
            "gray",
            "green",
            "orange",
            "pink",
            "purple",
            "red",
            "teal",
            "white",
            "yellow",
          ])
          .optional()
          .describe("Prefer images dominated by this color."),
      },
    },
    async (args) => {
      try {
        checkPageWindow(args.start, args.num);
        return ok(
          await client.searchImages({
            ...toSearchParams(args),
            size: args.size,
            type: args.type,
            colorType: args.color_type,
            dominantColor: args.dominant_color,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
