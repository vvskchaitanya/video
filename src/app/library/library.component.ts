import { Component, OnInit } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/storage';
import { FirestoreService } from '../services/firestore.service';
import { ToastrService } from 'ngx-toastr';
import { Utility } from '../services/utility';
import { UserFile } from '../models/models';

@Component({
  selector: 'app-library',
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.less']
})
export class LibraryComponent implements OnInit {

  search:string="";
  userfiles:UserFile[]=[];
  files:UserFile[]=[];
  preview:UserFile=null;

  constructor(public firestore:FirestoreService,private storage:AngularFireStorage,private toaster:ToastrService) { }

  ngOnInit(): void {
    this.loadUserFiles();
  }

  loadUserFiles = async()=>{
    this.userfiles=[];
    (await this.firestore.getUserFileCollection().get().toPromise()).docs.forEach(d=>{
        this.userfiles.push(d.data());
      });
      this.refresh();
  }

  refresh(){
    this.files=[];
    this.userfiles.forEach(file=>{
      if(this.search ==null || this.search=='')this.files.push(file);
      else{
        let n=file.name.toLocaleLowerCase(),s=this.search.toLocaleLowerCase();
        if(n.indexOf(s)>=0)this.files.push(file);
      }
    });
  }

  upload(event){
    let files:File[]=event.target.files;
    console.log("Files to upload : ",files);
    for(var i in files){
      let file=files[i];
      let id=Utility.uuidv4();
      this.firestore.getUserFileCollection().doc(id).set({
        id:id,
        name:file.name,
        type:file.type,
        bytes:file.size,
        date:new Date().toDateString(),
        time:new Date().toTimeString(),
        user:this.firestore.user.id,
        icon:Utility.getFileTypeIcon(file.type),
        size:Utility.bytesToSize(file.size),
        content:Utility.getContentType(file.type)
      });
      this.storage.ref(id).put(file).then(()=>{
        this.toaster.success("Uploaded "+file.name,"SUCCESS");
      });
    }
    this.loadUserFiles();
  }

  


  view=async (file:UserFile)=>{
    if(file.url==null){
      (await this.storage.ref(file.id).getDownloadURL()).toPromise().then((url)=>{
        file.url=url;
        this.preview=file;
      });
    }
    else this.preview=file;
    
  }

  
}
