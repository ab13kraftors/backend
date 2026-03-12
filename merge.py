import os

def merge_ts_to_txt(output_file="all_typescript_code.ts", src_folder="src"):
    if not os.path.exists(src_folder):
        print(f"Error: Folder '{src_folder}' not found.")
        return

    with open(output_file, "w", encoding="utf-8") as outfile:
        for root, dirs, files in os.walk(src_folder):
            for filename in sorted(files):
                # Filter for .ts files but skip .spec.ts files
                if filename.endswith(".ts") and not filename.endswith(".spec.ts"):
                    file_path = os.path.join(root, filename)
                    
                    try:
                        with open(file_path, "r", encoding="utf-8") as infile:
                            outfile.write(f"\n{'/'*25}\n")
                            outfile.write(f"// FILE: {file_path}\n")
                            outfile.write(f"{'/'*25}\n")
                            outfile.write(infile.read())
                    except Exception as e:
                        print(f"Could not read {filename}: {e}")

    print(f"Success! All .ts code (excluding specs) is now in {output_file}.")

if __name__ == "__main__":
    merge_ts_to_txt()
