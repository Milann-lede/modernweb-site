"""
File: python/optimize_images.py
Description: Script utilitaire pour scanner un dossier, redimensionner les images trop grandes
et les convertir au format WebP pour optimiser les performances web.
Path: /python/optimize_images.py
Dependencies: Pillow (PIL)
Author: ModernWeb
Last Updated: 2026-01-20
"""

import os
from PIL import Image

def optimize_image(input_path, output_path, max_width=None):
    """
    Optimise une image : redimensionnement et conversion WebP.
    
    Args:
        input_path (str): Chemin du fichier source.
        output_path (str): Chemin du fichier de destination.
        max_width (int, optional): Largeur maximale en pixels. Redimensionne si l'image est plus large.
    """
    try:
        with Image.open(input_path) as img:
            # Redimensionner si la largeur dépasse max_width
            if max_width and img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                # Utilisation du filtre LANCZOS pour un redimensionnement de haute qualité
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                print(f"Resized {input_path} to {max_width}x{new_height}")

            # Sauvegarder en WebP avec une qualité de 85%
            img.save(output_path, 'WEBP', quality=85)
            print(f"Saved optimized image to {output_path}")
    except Exception as e:
        print(f"Error processing {input_path}: {e}")

def main():
    """
    Fonction principale : scanne le dossier ../images et traite les fichiers compatibles.
    """
    images_dir = '../images'
    supported_extensions = ('.png', '.jpg', '.jpeg', '.webp')
    
    if not os.path.exists(images_dir):
        print(f"Directory not found: {images_dir}")
        return

    print(f"Scanning {images_dir} for images...")
    
    for filename in os.listdir(images_dir):
        if filename.lower().endswith(supported_extensions):
            input_path = os.path.join(images_dir, filename)
            file_root, _ = os.path.splitext(filename)
            output_path = os.path.join(images_dir, f"{file_root}.webp")
            
            # Note : Actuellement, on écrase/régénère systématiquement pour garantir l'application des réglages.
            # On pourrait ajouter une vérification de la date de modification pour ignorer les fichiers déjà à jour.
            
            print(f"Processing {filename}...")
            optimize_image(input_path, output_path, max_width=1024)

if __name__ == "__main__":
    main()
