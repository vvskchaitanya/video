import { Component, OnDestroy, OnInit , ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import { ImgCapture } from '../models/models';
import { Utility } from '../services/utility';
import {DomSanitizer} from '@angular/platform-browser';
import { FirestoreService } from '../services/firestore.service';
import { AngularFireStorage } from '@angular/fire/storage';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-camera',
  templateUrl: './camera.component.html',
  styleUrls: ['./camera.component.less']
})
export class CameraComponent implements OnInit,OnDestroy,AfterViewInit {

  options:string[]=[];
  cameras:{id;label;}[]=[];
  videostream:any=undefined;
  imagecapture:any=undefined;
  streaming=false;
  camera:string;
  settings:boolean=false;
  showCanvas:boolean=false;
  isMobile:boolean=Utility.mobileAndTabletCheck();
  captures:ImgCapture[]=[];
  showCaptures:boolean=false;
  processCanvas:boolean=false;
  layoutheight:string;
  fps:number=20;
  sx:number=300;
  sy:number=150;
  screenColor=new Color("#247722");
  colorPicker:boolean=false;
  colorDepth:any={r:10,g:10,b:10};
  devicePixelRatio:number=1;


  @ViewChild('canvas')
  canvas: ElementRef<HTMLCanvasElement>;
  @ViewChild('video')
  video: ElementRef<HTMLVideoElement>;
  public context: CanvasRenderingContext2D;

  temp_canvas: HTMLCanvasElement;
  temp_context: CanvasRenderingContext2D;

  chroma_canvas: HTMLCanvasElement;
  chroma_context: CanvasRenderingContext2D;
  chroma_image_data:ImageData;
  

  constructor(private sanitizer:DomSanitizer,public firestore:FirestoreService,private storage:AngularFireStorage,private toaster:ToastrService) { 
  }

  ngOnInit(): void {
    this.layoutheight=(window.innerHeight-65)+"";
    let a=this;
    window.onresize=function(){a.layoutheight=(window.innerHeight-65)+"";}
    console.log(this.layoutheight);
    if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
      console.log("Media Devices are available...");
      this.getCameraOptions();
    }
    this.captures=[];
  }

  ngOnDestroy(): void{
    this.captures=[];
    this.stopStream();
  }

  ngAfterViewInit(): void {
    this.context = this.canvas.nativeElement.getContext('2d');
    this.temp_canvas = document.createElement("canvas");
    this.temp_context = this.temp_canvas.getContext('2d');
    this.temp_context.imageSmoothingEnabled=false;
    this.context.imageSmoothingEnabled=false;
    this.updateCanvasSize();
    this.initializeChromaBackground();
  }

  initializeChromaBackground(){
    this.chroma_canvas = document.createElement("canvas");
    this.chroma_context = this.chroma_canvas.getContext('2d');
    this.chroma_canvas.width=Math.floor(this.canvas.nativeElement.width*window.devicePixelRatio);
    this.chroma_canvas.height=Math.floor(this.canvas.nativeElement.height*window.devicePixelRatio);
    this.chroma_context.fillStyle = "grey";
    this.chroma_context.fillRect(0, 0, this.chroma_canvas.width, this.chroma_canvas.height);
    this.chroma_image_data=this.chroma_context.getImageData(0, 0, this.sx, this.sy);
  }

  updateChromaImage(event){
    let file:File=event.target.files[0];
    console.log("Files to upload : ",file);
    var reader = new FileReader();
    reader.readAsDataURL(file);
    let a=this;
    reader.onloadend = function (e) {
      var myImage = new Image();
      myImage.src = e.target.result.toString();
      myImage.onload = function(ev) {
        a.chroma_context.drawImage(myImage,0,0, a.sx, a.sy);
        a.chroma_image_data=a.chroma_context.getImageData(0, 0, a.sx, a.sy);
      }
    }

  }


  updateCanvasSize(){
    this.devicePixelRatio=window.devicePixelRatio;
    this.canvas.nativeElement.width=Math.floor(this.canvas.nativeElement.width*window.devicePixelRatio);
    this.canvas.nativeElement.height=Math.floor(this.canvas.nativeElement.height*window.devicePixelRatio);
    this.temp_canvas.width=Math.floor(this.canvas.nativeElement.width*window.devicePixelRatio);
    this.temp_canvas.height=Math.floor(this.canvas.nativeElement.height*window.devicePixelRatio);
    this.sx=Math.floor(this.sx*window.devicePixelRatio);
    this.sy=Math.floor(this.sy*window.devicePixelRatio);
  }

  getCameraOptions = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    if(videoDevices==null || videoDevices.length==0)return alert("No Video devices found..");
    console.log(videoDevices);
    videoDevices.forEach(vd => {
      let label=vd.label;
      if(label==""){
        label="Cam "+(this.options.length+1);
      }
      this.options.push(label);
      this.cameras.push({id:vd.deviceId,label:label});
    });
    this.camera=this.options[0];
    this.startCamera();
  }

  toggleCamera(){
    if(this.camera==this.cameras[0].label){
      this.camera=this.cameras[1].label;
    }
    else if(this.camera==this.cameras[1].label){
      this.camera=this.cameras[0].label;      
    }
    else{
      console.log("Toggling Camera Failed in mobile device");
    }
    this.startCamera();
  }

  startCamera(){
    if(this.camera==null || this.camera=="")return;
    let cameraId=this.getCameraId(this.camera);
    console.log("Camera ID :",cameraId);
    if ('mediaDevices' in navigator && navigator.mediaDevices.getUserMedia && cameraId!=null) {
      let constraints = {
        video: { deviceId : cameraId, width: 1280, height: 720}
      };
      if(this.streaming){
        this.stopStream();
      }
      this.startStream(constraints);
    }

  }

  capturePhoto(){
    if(this.streaming && this.imagecapture!=null){
      if(this.showCanvas){
        this.canvas.nativeElement.toBlob((blob)=>{
          let img=new ImgCapture("Capture "+this.captures.length,blob);
          img.url=this.sanitize(window.URL.createObjectURL(blob));
          this.captures.push(img);
          console.log("Capture Added ",this.captures);
        });
      }
      else{
        this.imagecapture.takePhoto().then((blob)=>{
          let img=new ImgCapture("Capture "+this.captures.length,blob);
          img.url=this.sanitize(window.URL.createObjectURL(blob));
          this.captures.push(img);
          console.log("Capture Added ",this.captures);
        }).catch(this.handleError);
      }
    }
  }

     
  handleError(error) {
    console.error(error);
    alert("Camera Error..");
  }

  getCameraId(label){
    let match=this.cameras.filter(cam=>cam.label==label);
    if(match==null || match.length==0)return null;
    else return match[0].id;
  }
  
  startStream = (constraints) => {
    let a=this;
    navigator.mediaDevices.getUserMedia(constraints).then(stream=>{
      a.videostream = stream;
      a.imagecapture= new ImageCapture(stream.getVideoTracks()[0]);
      a.streaming = true;
    },
    rejected=>{alert("Camera Access Blocked...")});
  }

  stopStream = ()=>{
    this.streaming=false;
    if(this.videostream!=null){
      this.videostream.getTracks().forEach(function(track) {
        if (track.readyState == 'live') {
            track.stop();
        }
    });
    this.videostream=null;
    this.imagecapture==null;
    }
  }

  drawCanvas(){
    if(this.showCanvas && this.streaming && this.context!=null  && this.video!=null){
      if (this.processCanvas) {
        //Frame computing 
        this.temp_context.drawImage(this.video.nativeElement, 0, 0, this.sx, this.sy);
        let frame = this.temp_context.getImageData(0, 0, this.sx, this.sy);
        this.computeFrame(frame);
        this.context.putImageData(frame, 0, 0);
      }
      else {
        this.context.drawImage(this.video.nativeElement, 0, 0, this.sx, this.sy);
      }
      setTimeout(this.drawCanvas.bind(this), 1000 / this.fps);
    }  
  }

  canvasClicked(e:MouseEvent){
    var rect = this.canvas.nativeElement.getBoundingClientRect();
    var x= Math.floor((e.clientX-rect.left)*(this.sx/window.innerWidth));
    var y=Math.floor((e.clientY-rect.top)*(this.sy/(window.innerHeight-56)));
    console.log(e.clientX,rect.left,this.sx,window.innerWidth,x);
    var p = this.context.getImageData(x, y, 1, 1).data; 
    var hex = "#" + ("000000" + this.rgbToHex(p[0], p[1], p[2])).slice(-6);
    console.log("Canvas clicked ",x,y,p,hex);
    if(this.colorPicker){
      this.screenColor.hex=hex;
      this.updateScreenColor();  
      this.colorPicker=false;
    }
    
  }

  rgbToHex(r, g, b) {
    if (r > 255 || g > 255 || b > 255)
        throw "Invalid color component";
    return ((r << 16) | (g << 8) | b).toString(16);
  }

  updateScreenColor(){
    this.screenColor.update();
    
  }

  computeFrame(frame:ImageData){
    let r1=this.screenColor.rgb.r-this.colorDepth.r,r2=this.screenColor.rgb.r+this.colorDepth.r;
      let g1=this.screenColor.rgb.g-this.colorDepth.g,g2=this.screenColor.rgb.g+this.colorDepth.g;
      let b1=this.screenColor.rgb.b-this.colorDepth.b,b2=this.screenColor.rgb.b+this.colorDepth.b;
    for (let i = 0; i < frame.data.length /4; i++) {
      let r = frame.data[i * 4 + 0];
      let g = frame.data[i * 4 + 1];
      let b = frame.data[i * 4 + 2];
      if (r > r1 && r <= r2 && g > g1 && g <= g2 && b > b1 && b <= b2){
        frame.data[i * 4 + 0] = this.chroma_image_data.data[i * 4 + 0];
        frame.data[i * 4 + 1] = this.chroma_image_data.data[i * 4 + 0];
        frame.data[i * 4 + 2] = this.chroma_image_data.data[i * 4 + 0];
      }
    }
  }

  sanitize(url:string){
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  saveCapture(c:ImgCapture){
    let id=Utility.uuidv4();
      this.firestore.getUserFileCollection().doc(id).set({
        id:id,
        name:c.name,
        type:c.blob.type,
        bytes:c.blob.size,
        date:new Date().toDateString(),
        time:new Date().toTimeString(),
        user:this.firestore.user.id,
        icon:Utility.getFileTypeIcon(c.blob.type),
        size:Utility.bytesToSize(c.blob.size),
        content:Utility.getContentType(c.blob.type)
      });
      this.storage.ref(id).put(c.blob).then(()=>{
        this.toaster.success("Uploaded "+c.name,"SUCCESS");
      });
  }


  removeCapture(i){
    console.log("Removing capture "+i);
    this.captures.splice(i,1);
  }
}

export class RGB{
  r:number;
  g:number;
  b:number;
}

export class Color{
  hex:string;
  rgb:RGB;
  constructor(color:string){
    this.hex=color;
    this.update();
  }

  update(){
    let t=this.hexToRgb(this.hex);
    this.rgb=t!=null?t:this.rgb;
  }

  hexToRgb(hex:string):RGB {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
}

