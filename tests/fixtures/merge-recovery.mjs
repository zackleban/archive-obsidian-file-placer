// Synthetic only. JSON flow mappings are valid YAML and work with the existing
// host double's JSON parser; this does not test Obsidian's YAML implementation.
export const sourcePath = "Source/Source.md";
export const targetPath = "Target/Target.md";
export const sourceText = [
  "---", '{"status":"source","tags":["shared","source"]}', "---",
  "# Source", "", "Repeated line", "Repeated line", "",
  "````md", "```", "# Code heading stays literal", "[literal](Peer.md)", "````", "",
  "[bare peer](Peer.md)", "[explicit peer](./Peer.md)",
  "![relative marker](media/marker.svg)",
  "[self heading](../Source/Source.md#Source)", "",
].join("\r\n");
export const targetText = [
  "---", '{"status":"target","tags":["shared","target"]}', "---",
  "# Target", "", "Repeated line", "",
  "[target peer](./Peer.md)", "![target marker](media/marker.svg)",
].join("\n"); // Deliberately no final newline.
export const inboundPath = "Watch/Inbound.md";
export const fixtureFiles = {
  [sourcePath]: sourceText,
  [targetPath]: targetText,
  "Source/Peer.md": "# Peer\nSOURCE PEER marker\n",
  "Target/Peer.md": "# Peer\nTARGET PEER marker\n",
  "Source/media/marker.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><text x="5" y="25">SOURCE MEDIA</text></svg>\n',
  "Target/media/marker.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><text x="5" y="25">TARGET MEDIA</text></svg>\n',
  [inboundPath]: "# Inbound\n[Source heading](../Source/Source.md#Source)\n[[Source/Source]]\n[Target](../Target/Target.md)\n",
};
