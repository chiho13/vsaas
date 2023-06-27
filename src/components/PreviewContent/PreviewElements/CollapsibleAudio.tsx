import * as React from "react";
import { Button } from "@/components/ui/button";
import AudioPlayer from "@/components/AudioPlayer";

export const CollapsibleAudioPlayer = ({ node, children, key }) => {
  return (
    <div className="mb-2  space-y-2 rounded-md border p-2 dark:border-gray-700">
      {node.file_name && (
        <div key={key} className="mt-2 w-full rounded-md">
          <AudioPlayer
            id={node.id}
            audioURL={node.audio_url}
            fileName={node.file_name}
            classNames="py-0 shadow-none border-0"
            isPreview={true}
            showAudioPlayer={node.audioplayer}
          />
        </div>
      )}

      <div>{children}</div>
    </div>
  );
};
