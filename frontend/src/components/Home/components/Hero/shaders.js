export const vertexShader = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export const fragmentShader = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;

  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}

  float snoise(vec2 v){
    const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
    vec2 i=floor(v+dot(v,C.yy));
    vec2 x0=v-i+dot(i,C.xx);
    vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
    vec4 x12=x0.xyxy+C.xxzz;
    x12.xy-=i1;
    i=mod289(i);
    vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
    vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
    m=m*m;m=m*m;
    vec3 x=2.0*fract(p*C.www)-1.0;
    vec3 h=abs(x)-0.5;
    vec3 ox=floor(x+0.5);
    vec3 a0=x-ox;
    m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
    vec3 g;
    g.x=a0.x*x0.x+h.x*x0.y;
    g.yz=a0.yz*x12.xz+h.yz*x12.yw;
    return 130.0*dot(m,g);
  }

  float fbm(vec2 p){
    float value=0.0;float amplitude=0.5;float frequency=1.0;
    for(int i=0;i<4;i++){
      value+=amplitude*snoise(p*frequency);
      frequency*=2.0;amplitude*=0.5;
    }
    return value;
  }

  void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    vec2 center=vec2(0.5,0.5);
    vec2 pos=uv-center;
    float aspect=u_resolution.x/u_resolution.y;
    pos.x*=aspect;
    float dist=length(pos);
    float angle=atan(pos.y,pos.x);
    float t=u_time*0.15;
    float smoothDist=max(dist,0.001);
    float softAngle=angle+snoise(pos*2.0+t)*smoothstep(0.0,0.15,dist)*0.5;
    float spiral=softAngle+dist*4.0-t*2.0;
    float spiral2=softAngle-dist*3.0+t*1.5;
    vec2 nc1=vec2(cos(spiral)*smoothDist,sin(spiral)*smoothDist)*2.5;
    vec2 nc2=vec2(cos(spiral2)*smoothDist,sin(spiral2)*smoothDist)*3.0;
    float n1=fbm(nc1+t*0.3);
    float n2=fbm(nc2-t*0.2);
    float n3=fbm(vec2(smoothDist*5.0-t,softAngle*2.0)+n1*0.5);
    float combined=n1*0.4+n2*0.35+n3*0.25;
    float vs1=smoothstep(1.2,0.0,dist);
    float vs2=smoothstep(1.5,0.1,dist);

    vec3 deepBlue=vec3(0.05,0.07,0.11);
    vec3 midBlue=vec3(0.10,0.18,0.25);
    vec3 silverBlue=vec3(0.15,0.30,0.35);
    vec3 brightSilver=vec3(0.23,0.84,0.83);
    vec3 cyanGlow=vec3(0.55,0.95,0.90);

    vec3 col=deepBlue;
    col=mix(col,midBlue,vs2*(0.5+combined*0.5));
    col=mix(col,silverBlue,vs1*max(0.0,combined)*0.8);
    col=mix(col,cyanGlow,vs1*pow(max(0.0,n1),2.0)*0.4);
    float wisps=pow(max(0.0,combined),3.0)*vs1;
    col+=brightSilver*wisps*0.6;
    float highlight=pow(max(0.0,sin(spiral*3.0+n1*4.0)*0.5+0.5),8.0);
    highlight*=smoothstep(0.0,0.1,dist);
    col+=silverBlue*highlight*vs1*0.3;
    float centerGlow=exp(-dist*3.5)*0.4;
    col+=cyanGlow*centerGlow*(0.7+0.3*sin(t*3.0));

    float swirlAngle=angle-t*0.8+dist*3.0;
    vec2 sparkleUV=vec2(
      cos(swirlAngle)*dist+0.5,
      sin(swirlAngle)*dist+0.5
    );
    float sparkle=pow(max(0.0,snoise(sparkleUV*60.0+t*0.4)),16.0);
    col+=vec3(0.8,0.65,0.95)*sparkle*vs1*2.5;

    col*=0.9+0.1*sin(t*2.0);
    col=pow(col,vec3(0.95));
    gl_FragColor=vec4(col,1.0);
  }
`;