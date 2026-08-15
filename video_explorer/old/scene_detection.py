"""
Scene detection and video splitting using scenedetect.
Detects scene boundaries using adaptive detection and splits the video accordingly.
"""

from scenedetect import detect, AdaptiveDetector, split_video_ffmpeg
import os
import sys


def detect_and_split_scenes(video_file, output_dir=None):
    """
    Detect scenes in a video file and split it into separate clips.
    
    Args:
        video_file (str): Path to the input video file
        output_dir (str): Output directory for split videos (default: creates 'splits' folder)
    
    Returns:
        list: List of detected scenes with timestamps
    """
    
    # Validate input file
    if not os.path.exists(video_file):
        print(f"Error: Video file '{video_file}' not found!")
        return None
    
    # Create output directory if not specified
    if output_dir is None:
        output_dir = 'splits'
    
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created output directory: {output_dir}")
    
    try:
        # Detect scenes using AdaptiveDetector
        print(f"Detecting scenes in '{video_file}'...")
        scene_list = detect(video_file, AdaptiveDetector())
        
        if not scene_list:
            print("No scenes detected!")
            return None
        
        print(f"Detected {len(scene_list)} scene(s)")
        print("\nScene timestamps:")
        for i, scene in enumerate(scene_list, 1):
            print(f"  Scene {i}: {scene[0].get_seconds():.2f}s - {scene[1].get_seconds():.2f}s")
        
        # Split video based on detected scenes
        print(f"\nSplitting video into {len(scene_list)} part(s)...")
        split_video_ffmpeg(video_file, scene_list, output_dir=output_dir)
        
        print(f"Video split complete! Output files saved to: {output_dir}")
        return scene_list
        
    except Exception as e:
        print(f"Error during scene detection/splitting: {str(e)}")
        return None


def main():
    """Main function to run scene detection from command line."""
    
    # Default video file
    video_file = 'my_video.mp4'
    
    # Accept video file from command line argument
    if len(sys.argv) > 1:
        video_file = sys.argv[1]
    
    # Optional: specify output directory as second argument
    output_dir = sys.argv[2] if len(sys.argv) > 2 else 'splits'
    
    print(f"=" * 60)
    print("Scene Detection and Video Splitting Tool")
    print(f"=" * 60)
    print(f"Input video: {video_file}")
    print(f"Output directory: {output_dir}")
    print(f"=" * 60)
    
    # Run detection and splitting
    detect_and_split_scenes(video_file, output_dir)


if __name__ == "__main__":
    main()
