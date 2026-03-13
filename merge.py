import os

# def merge_ts_to_txt(output_file="all_typescript_code.ts", src_folder="src"):
#     if not os.path.exists(src_folder):
#         print(f"Error: Folder '{src_folder}' not found.")
#         return

#     with open(output_file, "w", encoding="utf-8") as outfile:
#         for root, dirs, files in os.walk(src_folder):
#             for filename in sorted(files):
#                 if filename.endswith(".ts") and not filename.endswith(".spec.ts"):
#                     file_path = os.path.join(root, filename)
                    
#                     try:
#                         with open(file_path, "r", encoding="utf-8") as infile:
#                             outfile.write(f"\n{'/'*25}\n")
#                             outfile.write(f"// FILE: {file_path}\n")
#                             outfile.write(f"{'/'*25}\n")
                            
#                             passed_imports = False
#                             is_in_multiline_import = False

#                             for line in infile:
#                                 stripped = line.strip()
                                
#                                 # 1. If we haven't passed the import section yet
#                                 if not passed_imports:
#                                     # If line starts with import, mark as in-block and skip
#                                     if stripped.startswith("import ") or stripped.startswith("import{"):
#                                         if ";" not in stripped:
#                                             is_in_multiline_import = True
#                                         continue
                                    
#                                     # If we are in the middle of a multi-line import, check for the end
#                                     if is_in_multiline_import:
#                                         if ";" in stripped:
#                                             is_in_multiline_import = False
#                                         continue
                                    
#                                     # If we see a decorator or export, the import section is OFFICIALLY over
#                                     if stripped.startswith("@") or stripped.startswith("export ") or stripped.startswith("class "):
#                                         passed_imports = True
#                                     else:
#                                         # Skip empty lines or comments at the very top
#                                         if not stripped or stripped.startswith("//"):
#                                             continue

#                                 # 2. Once passed_imports is True, write everything else (including @Module content)
#                                 if passed_imports:
#                                     outfile.write(line)
                                    
#                     except Exception as e:
#                         print(f"Could not read {filename}: {e}")

#     print(f"Success! Cleaned code is in {output_file}.")

# if __name__ == "__main__":
#     merge_ts_to_txt()



# import os

def merge_ts_to_txt(output_file="all_typescript.ts", src_folder="src"):
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
