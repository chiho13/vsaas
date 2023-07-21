import * as React from "react";
import { Button } from "@/components/ui/button";
import AudioPlayer from "@/components/AudioPlayer";
import { AudioManagerContext } from "@/contexts/PreviewAudioContext";

export const CollapsibleAudioPlayer = ({ node, children, index, nodes }) => {
  const containsMCQ = node.children.some((child) => child.type === "mcq");
  const containsBlockQuote = node.children.some(
    (child) => child.type === "block-quote"
  );
  const flexInline = node.content && node.content.length < 40;
  console.log(flexInline);
  const nodeIndex = nodes.indexOf(node);
  const isFirst = nodeIndex === 0;
  const isLastNode = nodeIndex === nodes.length - 1;
  console.log(nodeIndex);
  console.log(isLastNode);

  // determine if the node is the first node of type "tts" and not the first node overall
  const firstTTSIndex = nodes.findIndex((node) => node.type === "tts");
  const isFirstTTS = firstTTSIndex === nodes.indexOf(node);
  const isNotFirstOverall = nodes.indexOf(node) !== 1;

  // check if the previous node is a paragraph
  const prevNode = nodes[nodes.indexOf(node) - 1];
  const prevNodeIsPara = prevNode && prevNode.type === "paragraph";

  // determine if the node is the last node of type "tts"
  const lastTTSIndex = nodes
    .slice()
    .reverse()
    .findIndex((node) => node.type === "tts");
  const isLastTTS = nodes.length - 1 - lastTTSIndex === nodes.indexOf(node);
  const isNotLastOverall = nodeIndex === nodes.length;
  return (
    <div
      className={`mb-3 py-3
      ${node.content && isNotFirstOverall ? "border-t" : ""}
      ${
        node.content && isLastTTS && !isLastNode ? "border-b" : ""
      } mt-4 dark:border-accent 
      ${node.audioplayer ? "rounded-md border" : ""}
      `}
    >
      {node.audio_url && !containsMCQ && (
        <div
          className={`${
            node.content && node.content.length < 40 ? "absolute left-1 " : ""
          }`}
        >
          <AudioPlayer
            id={node.id}
            audioURL={node.audio_url}
            fileName={node.file_name}
            content={node.content}
            showAudio={node.audioplayer}
            classNames="py-0 shadow-none border-0"
            isPreview={true}
          />
        </div>
      )}
      {/* {BlockQuote} */}
      <div
        className={`${
          node.content && node.content.length < 40 ? "ml-[70px]" : ""
        }`}
      >
        {!node.audioplayer && children}
      </div>
    </div>
  );
};
