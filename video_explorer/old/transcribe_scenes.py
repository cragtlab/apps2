from __future__ import annotations

from pathlib import Path
import argparse

from faster_whisper import WhisperModel


def format_srt_timestamp(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


def write_srt(output_path: Path, segments) -> None:
    lines: list[str] = []
    for index, segment in enumerate(segments, start=1):
        text = segment.text.strip()
        if not text:
            continue

        lines.extend(
            [
                str(index),
                f"{format_srt_timestamp(segment.start)} --> {format_srt_timestamp(segment.end)}",
                text,
                "",
            ]
        )

    output_path.write_text("\n".join(lines), encoding="utf-8")


def transcribe_scene(model: WhisperModel, scene_path: Path, language: str | None) -> None:
    segments, info = model.transcribe(
        str(scene_path),
        language=language,
        vad_filter=True,
        beam_size=5,
        condition_on_previous_text=False,
    )
    segment_list = list(segments)
    output_path = scene_path.with_suffix(".srt")
    write_srt(output_path, segment_list)
    detected_language = info.language or "unknown"
    print(
        f"{scene_path.name}: {len(segment_list)} subtitle segment(s) "
        f"written to {output_path.name} (language={detected_language})"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe scene clips into .srt files.")
    parser.add_argument(
        "--input-dir",
        default="splits",
        help="Directory containing scene .mp4 files. Default: splits",
    )
    parser.add_argument(
        "--model",
        default="base",
        help="Faster-Whisper model size or local path. Default: base",
    )
    parser.add_argument(
        "--language",
        default=None,
        help="Language code, for example 'en'. Default: auto-detect",
    )
    parser.add_argument(
        "--compute-type",
        default="int8",
        help="Inference compute type. Default: int8",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    scene_files = sorted(input_dir.glob("*.mp4"))
    if not scene_files:
        raise SystemExit(f"No .mp4 scene files found in {input_dir}")

    model = WhisperModel(args.model, device="cpu", compute_type=args.compute_type)

    for scene_path in scene_files:
        transcribe_scene(model, scene_path, args.language)


if __name__ == "__main__":
    main()
