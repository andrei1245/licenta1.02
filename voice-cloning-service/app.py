from flask import Flask, request, send_file, Response
from flask_cors import CORS
import os
import tempfile
import subprocess
from pathlib import Path
import shutil

app = Flask(__name__)
CORS(app)

# Paths
MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)
RVC_DIR = Path(__file__).parent.parent / "rvc"
TRUMP_MODEL_PATH = MODELS_DIR / 'model.pth'
TRUMP_INDEX_PATH = MODELS_DIR / 'model.index'

def setup_rvc_model():
    """Copy Trump model to RVC weights directory"""
    try:
        # RVC expects models in assets/weights/ directory
        rvc_weights_dir = RVC_DIR / "assets" / "weights"
        rvc_weights_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy model
        rvc_model_dest = rvc_weights_dir / "trump.pth"
        if not rvc_model_dest.exists() and TRUMP_MODEL_PATH.exists():
            shutil.copy(TRUMP_MODEL_PATH, rvc_model_dest)
            print(f"✅ Copied model to: {rvc_model_dest}")
        
        # Copy index - RVC looks for it in logs/trump/ directory
        if TRUMP_INDEX_PATH.exists():
            rvc_logs_dir = RVC_DIR / "logs" / "trump"
            rvc_logs_dir.mkdir(parents=True, exist_ok=True)
            rvc_index_dest = rvc_logs_dir / "added_IVF256_Flat_nprobe_1_trump_v2.index"
            if not rvc_index_dest.exists():
                shutil.copy(TRUMP_INDEX_PATH, rvc_index_dest)
                print(f"✅ Copied index to: {rvc_index_dest}")
        
        return True
    except Exception as e:
        print(f"Error setting up RVC model: {e}")
        return False

def call_rvc_inference(input_audio_path):
    """
    Call RVC inference using infer_cli.py
    """
    try:
        print("Starting RVC inference...")
        
        # Setup model files
        setup_rvc_model()
        
        # Output path - RVC expects a file path, not a directory
        output_dir = tempfile.mkdtemp()
        output_file = os.path.join(output_dir, "output.wav")
        
        # RVC inference script
        infer_script = RVC_DIR / "tools" / "infer_cli.py"
        
        if not infer_script.exists():
            # Try alternative path
            infer_script = RVC_DIR / "infer_cli.py"
        
        if not infer_script.exists():
            raise FileNotFoundError(f"RVC infer_cli.py not found in {RVC_DIR}")
        
        # Build command for RVC inference
        # Don't specify index_path - let RVC auto-find it in logs/trump/
        # Use GPU for much faster processing
        cmd = [
            'py', '-3.10',  # Use Python 3.10
            str(infer_script),
            '--f0up_key', '0',
            '--input_path', input_audio_path,
            '--f0method', 'rmvpe',  # rmvpe works best with GPU
            '--opt_path', output_file,  # Full file path, not directory
            '--model_name', 'trump.pth',
            '--index_rate', '0.75',
            '--device', 'cuda:0',  # Use GPU
            '--is_half', 'True',  # Enable half precision for faster GPU processing
            '--filter_radius', '3',
            '--resample_sr', '0',
            '--rms_mix_rate', '0.25',
            '--protect', '0.33'
        ]
        
        print(f"Running RVC command...")
        print(f"Command: {' '.join(cmd)}")
        print(f"Working directory: {RVC_DIR}")
        print(f"Expected output: {output_file}")
        
        # Save logs to file for debugging
        log_file = os.path.join(tempfile.gettempdir(), "rvc_debug.log")
        
        # Run inference with longer timeout for CPU processing
        result = subprocess.run(
            cmd,
            cwd=str(RVC_DIR),
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        
        # Write detailed logs to file
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write(f"Command: {' '.join(cmd)}\n")
            f.write(f"Working dir: {RVC_DIR}\n")
            f.write(f"Return code: {result.returncode}\n")
            f.write(f"\n{'='*60}\n")
            f.write(f"STDOUT:\n{result.stdout}\n")
            f.write(f"\n{'='*60}\n")
            f.write(f"STDERR:\n{result.stderr}\n")
            f.write(f"{'='*60}\n")
        
        print(f"\n⚠️ RVC logs saved to: {log_file}")
        print(f"Return code: {result.returncode}")
        if result.stdout:
            print(f"STDOUT preview: {result.stdout[:200]}")
        if result.stderr:
            print(f"STDERR preview: {result.stderr[:200]}")
        
        # Check if output file was created
        if not os.path.exists(output_file):
            print(f"❌ Output file NOT created: {output_file}")
            if result.returncode != 0:
                raise RuntimeError(f"RVC failed with code {result.returncode}")
            else:
                raise FileNotFoundError(f"RVC didn't produce output file at {output_file}")
        
        file_size = os.path.getsize(output_file)
        print(f"✅ RVC output created: {output_file} ({file_size} bytes)")
        
        return output_file
    
    except Exception as e:
        print(f"❌ RVC inference error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

@app.route('/clone', methods=['POST'])
def clone_voice():
    try:
        if 'audio' not in request.files:
            return {'error': 'No audio file provided'}, 400
        
        audio_file = request.files['audio']
        target_voice = request.form.get('target_voice', 'trump')
        
        print(f"\n{'='*50}")
        print(f"🎤 Voice cloning request: {target_voice}")
        print(f"{'='*50}")
        
        if target_voice != 'trump':
            return {'error': 'Only Trump voice supported'}, 400
        
        # Check RVC availability
        if not RVC_DIR.exists():
            return {
                'error': 'RVC not installed',
                'message': 'Please install RVC in the rvc/ directory'
            }, 503
        
        # Save input
        input_path = tempfile.NamedTemporaryFile(delete=False, suffix='.wav').name
        audio_file.save(input_path)
        print(f"📁 Input saved: {input_path}")
        
        # Process with RVC
        try:
            output_path = call_rvc_inference(input_path)
        except Exception as e:
            os.unlink(input_path)
            return {'error': f'RVC inference failed: {str(e)}'}, 500
        
        # Convert to MP3
        try:
            from pydub import AudioSegment
            audio = AudioSegment.from_wav(output_path)
            mp3_path = output_path.replace('.wav', '.mp3')
            audio.export(mp3_path, format='mp3', bitrate='128k')
            os.unlink(output_path)
            final_path = mp3_path
            print(f"🎵 Converted to MP3: {final_path}")
        except Exception as e:
            print(f"Warning: MP3 conversion failed: {e}")
            final_path = output_path
        
        # Send response
        print(f"📤 Preparing to send file: {final_path}")
        
        # Check file exists and has content
        if not os.path.exists(final_path):
            raise FileNotFoundError(f"Output file not found: {final_path}")
        
        file_size = os.path.getsize(final_path)
        print(f"📦 File size: {file_size} bytes")
        
        if file_size == 0:
            raise ValueError("Output file is empty")
        
        # Read file content
        with open(final_path, 'rb') as f:
            file_content = f.read()
        
        print(f"✅ Read {len(file_content)} bytes from file")
        
        # Cleanup
        try:
            os.unlink(input_path)
            if os.path.exists(final_path):
                os.unlink(final_path)
        except Exception as e:
            print(f"Cleanup warning: {e}")
        
        print(f"✅ Sending response\n")
        
        return Response(
            file_content,
            mimetype='audio/mpeg' if final_path.endswith('.mp3') else 'audio/wav',
            headers={
                'Content-Disposition': 'attachment; filename=cloned_trump.mp3',
                'Content-Length': str(len(file_content))
            }
        )
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}, 500

@app.route('/health', methods=['GET'])
def health_check():
    rvc_exists = RVC_DIR.exists()
    model_exists = TRUMP_MODEL_PATH.exists()
    index_exists = TRUMP_INDEX_PATH.exists()
    
    infer_cli = RVC_DIR / "tools" / "infer_cli.py"
    if not infer_cli.exists():
        infer_cli = RVC_DIR / "infer_cli.py"
    infer_cli_exists = infer_cli.exists()
    
    return {
        'status': 'running',
        'available_voices': ['trump'],
        'rvc_installed': rvc_exists,
        'trump_model': 'loaded' if model_exists else 'missing',
        'trump_index': 'loaded' if index_exists else 'missing',
        'infer_cli': 'found' if infer_cli_exists else 'missing',
        'ready': rvc_exists and model_exists and infer_cli_exists
    }

if __name__ == '__main__':
    print("🎤 Voice Cloning Service - RVC Integration")
    print("=" * 60)
    print(f"📁 Models: {MODELS_DIR}")
    print(f"📁 RVC: {RVC_DIR}")
    print()
    
    # Check RVC
    if RVC_DIR.exists():
        print(f"✅ RVC found")
        infer_cli = RVC_DIR / "tools" / "infer_cli.py"
        if not infer_cli.exists():
            infer_cli = RVC_DIR / "infer_cli.py"
        if infer_cli.exists():
            print(f"✅ infer_cli.py found")
        else:
            print(f"❌ infer_cli.py NOT FOUND")
            print(f"   Check RVC installation")
    else:
        print(f"❌ RVC NOT FOUND")
        print(f"   Run: git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git rvc")
    
    # Check model
    if TRUMP_MODEL_PATH.exists():
        size_mb = TRUMP_MODEL_PATH.stat().st_size / (1024*1024)
        print(f"✅ Trump model: {size_mb:.1f} MB")
    else:
        print(f"❌ Trump model missing")
    
    # Check index
    if TRUMP_INDEX_PATH.exists():
        print(f"✅ Trump index found")
    else:
        print(f"⚠️  Trump index missing (optional)")
    
    print()
    print("⚠️  REQUIREMENTS:")
    print("   - Python 3.10 recommended for RVC")
    print("   - RVC dependencies must be installed")
    print("   - Run: cd rvc && pip install -r requirements.txt")
    print()
    print("=" * 60)
    print("🌐 Server: http://localhost:5001")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5001, debug=False)
