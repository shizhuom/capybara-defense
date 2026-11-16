/** Pixel offsets are expressed in the sprite's centered, unscaled local coordinates. */
export interface RigPose {
  phase:number;spineLag:number;leanX:number;waveAmpX:number;breatheAmp:number;
  strideX:number;liftY:number;splitLegs:boolean;
}

const HIP=.72,OVERLAP=.8;
function dimension(...values:unknown[]):number {
  return values.find((value):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0)??0;
}

/** Draw one stable source image as a soft spine with an optional split, alternating foot stride. */
export function drawPuppetSprite(c:CanvasRenderingContext2D,image:CanvasImageSource,size:number,rigPose:RigPose):void {
  const source=image as unknown as {naturalWidth?:number;naturalHeight?:number;videoWidth?:number;videoHeight?:number;width?:number;height?:number};
  const width=dimension(source.naturalWidth,source.videoWidth,source.width);
  const height=dimension(source.naturalHeight,source.videoHeight,source.height);
  if(!width||!height||!Number.isFinite(size)||size<=0)return;
  const band=(top:number,bottom:number,left:number,right:number,offsetX:number,offsetY:number,scaleX:number)=>{
    // Clamp both ends independently: small canvases and image edges must never sample out of bounds.
    const sx=left*width,ex=right*width;
    const sy=Math.max(0,top*height-OVERLAP/2),ey=Math.min(height,bottom*height+OVERLAP/2);
    const dy=Math.max(0,top*size-OVERLAP/2),endY=Math.min(size,bottom*size+OVERLAP/2);
    c.drawImage(image,sx,sy,ex-sx,ey-sy,(left-.5)*size*scaleX+offsetX,dy-size/2+offsetY,(right-left)*size*scaleX,endY-dy);
  };
  let rootX=0,rootScale=1;
  for(let i=0;i<6;i++){
    const top=i*HIP/6,bottom=(i+1)*HIP/6,u=(top+bottom)/2;
    const localPhase=rigPose.phase-(HIP-u)*rigPose.spineLag;
    const offsetX=rigPose.leanX*(HIP-u)+rigPose.waveAmpX*Math.sin(localPhase)*(.3+.7*(1-u));
    const scaleX=1+rigPose.breatheAmp*Math.sin(localPhase*2);
    band(top,bottom,0,1,offsetX,0,scaleX);
    rootX=offsetX;rootScale=scaleX;
  }
  const stride=rigPose.strideX*Math.sin(rigPose.phase),lift=Math.cos(rigPose.phase);
  for(let i=0;i<3;i++){
    const top=HIP+(1-HIP)*i/3,bottom=HIP+(1-HIP)*(i+1)/3,weight=i/2;
    if(rigPose.splitLegs){
      // The hip band inherits the torso exactly; motion grows to full amplitude at the sole.
      band(top,bottom,0,.52,rootX+stride*weight,-rigPose.liftY*Math.max(0,lift)*weight,rootScale);
      band(top,bottom,.48,1,rootX-stride*weight,-rigPose.liftY*Math.max(0,-lift)*weight,rootScale);
    }else band(top,bottom,0,1,rootX,0,rootScale);
  }
}
